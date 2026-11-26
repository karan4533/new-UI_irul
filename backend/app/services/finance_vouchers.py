"""Unified payment voucher register (fees, vendor AP, payroll) + vendor liability payment."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.deps import permission_codes_for, role_code_for
from app.models import User
from app.services import finance as fin
from app.services.audit import write_audit
from app.services.errors import fail
from app.services.finance_actions import (
    _append_accounting_posting,
    _gl_amounts_balanced,
    _is_payroll_reversal,
    _now,
    _seq,
)
from app.services.purchase import COL_LIABILITIES, _get as purchase_get, _list as purchase_list, _put as purchase_put

_VOUCHER_WRITE_ROLES = {"accounthead", "finance", "financeassistant", "admin", "superadmin"}


def _kind(row: dict) -> str:
    module = str(row.get("sourceModule") or "").upper()
    if module == "PAYROLL":
        return "payroll_reversal" if _is_payroll_reversal(row) else "payroll"
    if module == "PURCHASE":
        return "vendor_payment"
    return "fee"


def _normalize_liability(row: dict) -> dict:
    amount = float(row.get("amount") or row.get("amountDue") or 0)
    status = str(row.get("status") or "Open")
    paid = status.lower() == "paid"
    return {
        "id": row.get("id"),
        "voucherNo": row.get("voucherNumber") or row.get("voucherNo") or row.get("id"),
        "transactionNo": row.get("poNumber") or row.get("poId"),
        "transactionDate": str(row.get("createdAt") or "")[:10],
        "payee": row.get("vendorName") or row.get("payeeName") or "Vendor",
        "category": row.get("liabilityAccount") or "Accounts Payable",
        "amount": amount,
        "status": "Paid" if paid else "Pending Payment",
        "voucherStatus": "Paid" if paid else "Pending Payment",
        "paymentMode": row.get("paymentMode") or "BANK_TRANSFER",
        "narration": f"Purchase Order {row.get('poNumber') or row.get('poId')} payable to {row.get('vendorName') or 'vendor'}",
        "preparedBy": row.get("createdBy") or "Procurement",
        "isVendorLiability": True,
        "voucherKind": "vendor_ap",
        "poId": row.get("poId"),
        "paidTransactionId": row.get("paidTransactionId"),
        "dueDate": row.get("dueDate"),
    }


def list_payment_vouchers(db: Session, actor: User) -> dict:
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")
    state = fin.get_state(db, actor)
    data = state["data"]
    students = {
        str(row.get("id")): row
        for row in (data.get("students") or [])
        if isinstance(row, dict) and row.get("id")
    }

    fees: list[dict] = []
    payroll: list[dict] = []
    reversals: list[dict] = []
    vendor_payments: list[dict] = []
    for row in data.get("transactions") or []:
        if not isinstance(row, dict):
            continue
        kind = _kind(row)
        enriched = {**row, "voucherKind": kind}
        if kind == "fee":
            student = students.get(str(row.get("studentId") or ""))
            enriched["payee"] = (student or {}).get("name") or row.get("vendorId") or "Not linked"
            fees.append(enriched)
        elif kind == "payroll":
            payroll.append(enriched)
        elif kind == "payroll_reversal":
            reversals.append(enriched)
        else:
            enriched["payee"] = row.get("payee") or row.get("vendorName") or "Vendor"
            vendor_payments.append(enriched)

    liabilities = [_normalize_liability(row) for row in purchase_list(db, actor, COL_LIABILITIES)]
    open_liabilities = [row for row in liabilities if row["status"] != "Paid"]
    return {
        "success": True,
        "fees": fees,
        "vendorLiabilities": liabilities,
        "vendorPayments": vendor_payments,
        "payroll": payroll,
        "payrollReversals": reversals,
        "counts": {
            "fees": len(fees),
            "vendorLiabilities": len(liabilities),
            "vendorOpen": len(open_liabilities),
            "vendorPayments": len(vendor_payments),
            "payroll": len(payroll),
            "payrollReversals": len(reversals),
            "total": len(fees) + len(liabilities) + len(vendor_payments) + len(payroll) + len(reversals),
        },
    }


def pay_vendor_liability(db: Session, actor: User, payload: dict) -> dict:
    code = role_code_for(db, actor)
    perms = set(permission_codes_for(db, actor))
    if code not in _VOUCHER_WRITE_ROLES and "finance.write" not in perms:
        fail(403, "forbidden", "Not allowed to pay vendor liabilities.")
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")

    liability_id = str((payload or {}).get("liabilityId") or (payload or {}).get("id") or "").strip()
    if not liability_id:
        fail(400, "validation_error", "liabilityId is required.")

    row, liability = purchase_get(db, actor, COL_LIABILITIES, liability_id)
    if str(liability.get("status") or "").lower() == "paid":
        return {
            "success": True,
            "skipped": True,
            "reason": "already_paid",
            "liability": _normalize_liability(liability),
            "transactionId": liability.get("paidTransactionId"),
        }

    amount = float(liability.get("amount") or 0)
    if amount <= 0:
        fail(400, "validation_error", "Liability amount must be greater than zero.")

    public_id = f"VPAY-{liability_id}"
    state = fin.get_state(db, actor)
    data = dict(state["data"])
    transactions = list(data.get("transactions") or [])
    if any(str(t.get("id")) == public_id for t in transactions):
        return {"success": True, "skipped": True, "reason": "already_paid", "transactionId": public_id}

    seq = _seq(data)
    seq["txn"] += 1
    seq["voucher"] += 1
    mode = str((payload or {}).get("paymentMode") or "BANK_TRANSFER").upper()
    txn = {
        "id": public_id,
        "transactionNo": f"TXN-{seq['txn']:04d}",
        "transactionDate": _now()[:10],
        "direction": "OUT",
        "sourceModule": "PURCHASE",
        "category": "Accounts Payable - Vendor",
        "paymentMode": mode,
        "amount": amount,
        "vendorId": liability.get("vendorId"),
        "vendorName": liability.get("vendorName"),
        "payee": liability.get("vendorName"),
        "status": "POSTED",
        "voucherNo": f"PV-{seq['voucher']:04d}",
        "voucherType": "Payment",
        "voucherStatus": "Paid",
        "preparedBy": actor.email,
        "narration": f"Vendor payment for {liability.get('poNumber') or liability.get('poId')} — {liability.get('vendorName')}",
        "createdBy": actor.email,
        "createdAt": _now(),
        "entryType": "Expense",
        "linkedLiabilityId": liability_id,
        "linkedPoId": liability.get("poId"),
        "campusId": str(actor.campus_id),
    }
    transactions.insert(0, txn)
    data["transactions"] = transactions
    _append_accounting_posting(data, txn, None)
    balanced, debit_total, credit_total = _gl_amounts_balanced(data, public_id)
    if not balanced:
        fail(500, "accounting_imbalance", f"Vendor payment GL not balanced ({debit_total} vs {credit_total}).")

    fin.persist_state(
        db,
        actor,
        {"data": data},
        commit=False,
        audit_action="FINANCE_VENDOR_PAYMENT_STATE",
    )
    liability = {
        **liability,
        "status": "Paid",
        "paidAt": _now(),
        "paidBy": actor.email,
        "paidTransactionId": public_id,
        "paymentMode": mode,
    }
    purchase_put(db, actor, COL_LIABILITIES, liability_id, liability)
    write_audit(
        db,
        action="finance.vendor_payment.post",
        entity_type="finance_transaction",
        entity_id=public_id[:64],
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"liability={liability_id};amount={amount};voucher={txn['voucherNo']}",
    )
    db.commit()
    return {
        "success": True,
        "skipped": False,
        "transaction": txn,
        "voucherNo": txn["voucherNo"],
        "liability": _normalize_liability(liability),
        "glBalanced": True,
    }
