"""School wallet ledger: wallets, offline (cash/cheque/bank) recharges, spends, freeze/flag — live on campus finance snapshot.

External gateway recharges (UPI / card / net banking) are NOT supported until a payment connector exists.
Wallet balances are a liability of the school: recharge = Dr Cash/Bank, Cr wallet liability; spend = Dr wallet liability, Cr sales income.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.deps import role_code_for
from app.models import User
from app.services import finance as fin
from app.services.audit import write_audit
from app.services.errors import fail
from app.services.finance_actions import (
    _append_accounting_posting,
    _gl_amounts_balanced,
    _inr_label,
    _now,
    _seq,
)

WALLET_LIABILITY = "Wallet Balances Payable (User Wallets)"
_IST = timezone(timedelta(hours=5, minutes=30))
_WALLET_ROLES = {"accounthead", "finance", "financeassistant", "finance_assistant", "admin", "superadmin"}
_OWNER_TYPES = {"student": "Student", "staff": "Staff", "parent": "Parent"}
_OFFLINE_MODES = {"CASH", "CHEQUE", "BANK_TRANSFER"}
_GATEWAY_MODES = {"UPI", "CARD", "CARD_ONLINE", "CARD_POS", "NET_BANKING", "PAYMENT_GATEWAY"}
_STATUSES = {"Active", "Frozen", "Flagged"}
_CATEGORIES = {"Canteen", "Stationery", "Events", "Other"}


def _money_label(amount: float) -> str:
    value = round(float(amount or 0), 2)
    if abs(value - round(value)) < 0.005:
        return f"₹{int(round(value)):,}"
    return f"₹{value:,.2f}"


def _ist_now() -> datetime:
    return datetime.now(_IST)


def _stamp(iso: str | None) -> str:
    try:
        parsed = datetime.fromisoformat(str(iso)).astimezone(_IST)
    except (TypeError, ValueError):
        return str(iso or "—")
    return parsed.strftime("%d %b, %I:%M%p").replace("AM", "am").replace("PM", "pm").lstrip("0")


def _initials(name: str) -> str:
    return "".join(part[0] for part in str(name or "").split()[:2]).upper() or "?"


def _require_role(db: Session, actor: User) -> None:
    if role_code_for(db, actor) not in _WALLET_ROLES:
        fail(403, "forbidden", "Not allowed to manage wallets.")
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")


def _amount(value, field="amount") -> float:
    try:
        amount = round(float(value), 2)
    except (TypeError, ValueError):
        fail(400, "validation_error", f"{field} must be a number.")
    if amount <= 0:
        fail(400, "validation_error", f"{field} must be greater than zero.")
    if amount > 1_000_000:
        fail(400, "validation_error", f"{field} exceeds the per-transaction limit.")
    return amount


def _ref_id(prefix: str, reference: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "-", reference).strip("-")
    naive = f"{prefix}-{cleaned}"
    if cleaned and len(naive) <= 48:
        return naive
    return f"{prefix}-{hashlib.sha1(reference.encode('utf-8')).hexdigest()[:20].upper()}"


def _wallet_view(wallet: dict) -> dict:
    balance = float(wallet.get("balance") or 0)
    status = wallet.get("status") or "Active"
    display = "Zero Balance" if status == "Active" and balance <= 0 else status
    return {
        **wallet,
        "initials": _initials(wallet.get("name")),
        "balanceAmount": round(balance, 2),
        "balance": _money_label(balance),
        "lastRecharge": _stamp(wallet.get("lastRechargeAt")).split(",")[0] if wallet.get("lastRechargeAt") else "—",
        "status": display,
        "storedStatus": status,
    }


def _wallet_by_ref(wallets: list[dict], wallet_id: str | None, email: str | None):
    if wallet_id:
        found = next((w for w in wallets if w.get("walletId") == wallet_id or w.get("id") == wallet_id), None)
        if found:
            return found
    if email:
        key = email.strip().lower()
        return next((w for w in wallets if str(w.get("email") or "").lower() == key), None)
    return None


def list_wallets(db: Session, actor: User) -> dict:
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")
    data = fin.get_state(db, actor)["data"]
    wallets = [w for w in (data.get("wallets") or []) if isinstance(w, dict)]
    recharges = [r for r in (data.get("walletRecharges") or []) if isinstance(r, dict)]
    spends = [s for s in (data.get("walletSpends") or []) if isinstance(s, dict)]
    by_id = {w.get("walletId"): w for w in wallets}

    today = _ist_now().date()
    month = (today.year, today.month)

    def _on(iso):
        try:
            return datetime.fromisoformat(str(iso)).astimezone(_IST).date()
        except (TypeError, ValueError):
            return None

    views = [_wallet_view(w) for w in wallets]
    recharge_rows = []
    for r in recharges:
        owner = by_id.get(r.get("walletId"), {})
        recharge_rows.append(
            {
                "id": r.get("id"),
                "walletId": r.get("walletId"),
                "user": owner.get("name") or r.get("user") or "—",
                "initials": _initials(owner.get("name") or r.get("user")),
                "role": owner.get("role") or r.get("role") or "—",
                "mode": {"CASH": "Offline", "CHEQUE": "Offline", "BANK_TRANSFER": "Offline"}.get(
                    str(r.get("mode") or "").upper(), r.get("mode")
                ),
                "paymentMode": r.get("mode"),
                "amount": _money_label(r.get("amount")),
                "amountValue": float(r.get("amount") or 0),
                "dateTime": _stamp(r.get("at")),
                "at": r.get("at"),
                "status": r.get("status") or "Success",
                "reference": r.get("reference"),
            }
        )
    spend_rows = []
    for s in spends:
        owner = by_id.get(s.get("walletId"), {})
        spend_rows.append(
            {
                "id": s.get("id"),
                "walletId": s.get("walletId"),
                "user": owner.get("name") or "—",
                "initials": _initials(owner.get("name")),
                "role": owner.get("role") or "—",
                "vendor": s.get("vendor"),
                "category": s.get("category"),
                "dateTime": _stamp(s.get("at")),
                "at": s.get("at"),
                "amount": f"−{_money_label(s.get('amount'))}",
                "amountValue": float(s.get("amount") or 0),
                "reference": s.get("reference"),
            }
        )

    total_held = sum(float(w.get("balance") or 0) for w in wallets)
    by_role: dict[str, float] = {}
    for w in wallets:
        by_role[w.get("role") or "Other"] = by_role.get(w.get("role") or "Other", 0.0) + float(w.get("balance") or 0)
    ok = [r for r in recharges if (r.get("status") or "Success") == "Success"]
    recharge_today = [r for r in ok if _on(r.get("at")) == today]
    recharge_month = [r for r in ok if (lambda d: d and (d.year, d.month) == month)(_on(r.get("at")))]
    spend_today = [s for s in spends if _on(s.get("at")) == today]
    spend_month = [s for s in spends if (lambda d: d and (d.year, d.month) == month)(_on(s.get("at")))]
    spend_total_month = sum(float(s.get("amount") or 0) for s in spend_month)
    categories: dict[str, float] = {}
    for s in spend_month:
        categories[s.get("category") or "Other"] = categories.get(s.get("category") or "Other", 0.0) + float(s.get("amount") or 0)

    ledger_drift = []
    for w in wallets:
        credits = sum(float(r.get("amount") or 0) for r in ok if r.get("walletId") == w.get("walletId"))
        debits = sum(float(s.get("amount") or 0) for s in spends if s.get("walletId") == w.get("walletId"))
        if abs((credits - debits) - float(w.get("balance") or 0)) >= 0.01:
            ledger_drift.append(w.get("walletId"))

    return {
        "success": True,
        "wallets": views,
        "recharges": recharge_rows,
        "spends": spend_rows,
        "summary": {
            "walletCount": len(wallets),
            "totalHeld": round(total_held, 2),
            "active": sum(1 for v in views if v["status"] == "Active"),
            "zeroBalance": sum(1 for v in views if v["status"] == "Zero Balance"),
            "frozenOrFlagged": sum(1 for v in views if v["storedStatus"] in {"Frozen", "Flagged"}),
            "avgBalance": round(total_held / len(wallets), 2) if wallets else 0,
            "rechargesTodayAmount": round(sum(float(r.get("amount") or 0) for r in recharge_today), 2),
            "rechargesTodayCount": len(recharge_today),
            "rechargesMonthAmount": round(sum(float(r.get("amount") or 0) for r in recharge_month), 2),
            "rechargesMonthCount": len(recharge_month),
            "avgRecharge": round(sum(float(r.get("amount") or 0) for r in ok) / len(ok), 2) if ok else 0,
            "failedRecharges": sum(1 for r in recharges if r.get("status") == "Failed"),
            "spentTodayAmount": round(sum(float(s.get("amount") or 0) for s in spend_today), 2),
            "spentTodayCount": len(spend_today),
            "spentMonthAmount": round(spend_total_month, 2),
            "spentMonthCount": len(spend_month),
            "balanceByRole": [
                {"label": f"{role}s", "amountValue": round(total, 2), "amount": _money_label(total),
                 "value": round(total / total_held * 100) if total_held else 0}
                for role, total in sorted(by_role.items())
            ],
            "spendCategories": [
                {"label": cat, "amountValue": round(total, 2), "amount": _money_label(total),
                 "percent": f"{round(total / spend_total_month * 100)}%" if spend_total_month else "0%"}
                for cat, total in sorted(categories.items(), key=lambda kv: -kv[1])
            ],
            "ledgerDrift": ledger_drift,
        },
        "rechargeMethods": [
            {"id": "RM-CASH", "method": "Cash (front desk)", "icon": "cash", "minAmount": "₹1", "maxAmount": "₹10,00,000", "processingFee": "Nil", "status": "Enabled"},
            {"id": "RM-CHEQUE", "method": "Cheque", "icon": "bank", "minAmount": "₹1", "maxAmount": "₹10,00,000", "processingFee": "Nil", "status": "Enabled"},
            {"id": "RM-BANK", "method": "Bank transfer (manual)", "icon": "bank", "minAmount": "₹1", "maxAmount": "₹10,00,000", "processingFee": "Nil", "status": "Enabled"},
            {"id": "RM-UPI", "method": "UPI", "icon": "qr", "minAmount": "—", "maxAmount": "—", "processingFee": "—", "status": "Disabled"},
            {"id": "RM-CARD", "method": "Debit / Credit Card", "icon": "card", "minAmount": "—", "maxAmount": "—", "processingFee": "—", "status": "Disabled"},
            {"id": "RM-NB", "method": "Net Banking", "icon": "bank", "minAmount": "—", "maxAmount": "—", "processingFee": "—", "status": "Disabled"},
        ],
    }


def open_wallet(db: Session, actor: User, payload: dict) -> dict:
    _require_role(db, actor)
    body = payload or {}
    name = str(body.get("name") or "").strip()
    email = str(body.get("email") or "").strip().lower()
    role = _OWNER_TYPES.get(str(body.get("role") or body.get("ownerType") or "").strip().lower())
    if not name:
        fail(400, "validation_error", "name is required.")
    if not email or "@" not in email:
        fail(400, "validation_error", "A valid email is required.")
    if role is None:
        fail(400, "validation_error", "role must be Student, Staff or Parent.")

    data = dict(fin.get_state(db, actor)["data"])
    wallets = [dict(w) for w in (data.get("wallets") or []) if isinstance(w, dict)]
    existing = _wallet_by_ref(wallets, None, email)
    if existing:
        return {"success": True, "skipped": True, "reason": "already_exists", "wallet": _wallet_view(existing)}

    used = [int(m.group(1)) for w in wallets if (m := re.search(r"(\d+)$", str(w.get("walletId") or "")))]
    number = (max(used) + 1) if used else 10001
    wallet = {
        "id": f"UW-{number}",
        "walletId": f"WLT-{number:05d}",
        "name": name,
        "email": email,
        "role": role,
        "ownerId": body.get("ownerId"),
        "balance": 0.0,
        "status": "Active",
        "lastRechargeAt": None,
        "createdAt": _now(),
        "createdBy": actor.email,
    }
    wallets.insert(0, wallet)
    data["wallets"] = wallets
    fin.persist_state(db, actor, {"data": data}, commit=False, audit_action="FINANCE_WALLET_STATE")
    write_audit(
        db, action="finance.wallet.open", entity_type="finance_wallet", entity_id=wallet["walletId"],
        actor_id=actor.id, campus_id=actor.campus_id, details=f"role={role};email={email}",
    )
    db.commit()
    return {"success": True, "skipped": False, "wallet": _wallet_view(wallet)}


def recharge_wallet(db: Session, actor: User, payload: dict) -> dict:
    _require_role(db, actor)
    body = payload or {}
    amount = _amount(body.get("amount"))
    mode = str(body.get("mode") or body.get("paymentMode") or "CASH").strip().upper().replace(" ", "_")
    if mode in _GATEWAY_MODES:
        fail(409, "gateway_unavailable", "Online gateway recharge is not connected. Record cash, cheque or bank transfer instead.")
    if mode not in _OFFLINE_MODES:
        fail(400, "validation_error", "mode must be CASH, CHEQUE or BANK_TRANSFER.")
    reference = str(body.get("reference") or body.get("idempotencyKey") or "").strip()
    if not reference:
        fail(400, "validation_error", "reference (receipt / idempotency key) is required.")

    data = dict(fin.get_state(db, actor)["data"])
    wallets = [dict(w) for w in (data.get("wallets") or []) if isinstance(w, dict)]
    wallet = _wallet_by_ref(wallets, body.get("walletId"), body.get("email"))
    if wallet is None:
        fail(404, "not_found", "No wallet found for this wallet ID / email.")
    if wallet.get("status") == "Frozen":
        fail(409, "wallet_frozen", "This wallet is frozen.")

    recharge_id = _ref_id("RCG", reference)
    recharges = [dict(r) for r in (data.get("walletRecharges") or []) if isinstance(r, dict)]
    existing = next((r for r in recharges if r.get("id") == recharge_id), None)
    if existing is not None:
        return {"success": True, "skipped": True, "reason": "already_recorded", "wallet": _wallet_view(wallet), "recharge": existing}

    seq = _seq(data)
    seq["txn"] += 1
    seq["voucher"] += 1
    txn_id = f"WTXN-{recharge_id}"[:48]
    txn = {
        "id": txn_id,
        "transactionNo": f"TXN-{seq['txn']:04d}",
        "transactionDate": _now()[:10],
        "direction": "IN",
        "sourceModule": "WALLET",
        "category": "Wallet Recharge",
        "paymentMode": mode,
        "amount": amount,
        "status": "POSTED",
        "voucherNo": f"RV-W{seq['voucher']:04d}",
        "voucherType": "Receipt",
        "voucherStatus": "Issued",
        "preparedBy": actor.email,
        "narration": f"Wallet recharge — {wallet.get('name')} ({wallet.get('walletId')})",
        "createdBy": actor.email,
        "createdAt": _now(),
        "entryType": "Income",
        "linkedWalletId": wallet.get("walletId"),
        "campusId": str(actor.campus_id),
    }
    transactions = list(data.get("transactions") or [])
    transactions.insert(0, txn)
    data["transactions"] = transactions
    _append_accounting_posting(data, txn, None)
    # Credit side belongs to the wallet liability, not fee income.
    for row in data.get("glEntries") or []:
        if str(row.get("sourceTransactionId") or "") == txn_id and str(row.get("credit") or "—") != "—":
            row["ledgerAccount"] = WALLET_LIABILITY
    balanced, debit_total, credit_total = _gl_amounts_balanced(data, txn_id)
    if not balanced:
        fail(500, "accounting_imbalance", f"Wallet recharge GL not balanced ({debit_total} vs {credit_total}).")

    at = _now()
    recharge = {
        "id": recharge_id,
        "walletId": wallet["walletId"],
        "amount": amount,
        "mode": mode,
        "status": "Success",
        "reference": reference,
        "note": str(body.get("note") or "").strip(),
        "at": at,
        "transactionId": txn_id,
        "createdBy": actor.email,
    }
    recharges.insert(0, recharge)
    data["walletRecharges"] = recharges
    wallet["balance"] = round(float(wallet.get("balance") or 0) + amount, 2)
    wallet["lastRechargeAt"] = at
    wallets[wallets.index(next(w for w in wallets if w.get("walletId") == wallet["walletId"]))] = wallet
    data["wallets"] = wallets

    fin.persist_state(db, actor, {"data": data}, commit=False, audit_action="FINANCE_WALLET_RECHARGE_STATE")
    write_audit(
        db, action="finance.wallet.recharge", entity_type="finance_wallet", entity_id=wallet["walletId"],
        actor_id=actor.id, campus_id=actor.campus_id,
        details=f"amount={amount};mode={mode};ref={reference[:40]};voucher={txn['voucherNo']}",
    )
    db.commit()
    return {
        "success": True, "skipped": False, "wallet": _wallet_view(wallet), "recharge": recharge,
        "voucherNo": txn["voucherNo"], "glBalanced": True,
    }


def spend_from_wallet(db: Session, actor: User, payload: dict) -> dict:
    _require_role(db, actor)
    body = payload or {}
    amount = _amount(body.get("amount"))
    category = str(body.get("category") or "Other").strip().title()
    if category not in _CATEGORIES:
        fail(400, "validation_error", f"category must be one of {', '.join(sorted(_CATEGORIES))}.")
    vendor = str(body.get("vendor") or "").strip()
    if not vendor:
        fail(400, "validation_error", "vendor / item is required.")
    reference = str(body.get("reference") or body.get("idempotencyKey") or "").strip()
    if not reference:
        fail(400, "validation_error", "reference (POS bill / idempotency key) is required.")

    data = dict(fin.get_state(db, actor)["data"])
    wallets = [dict(w) for w in (data.get("wallets") or []) if isinstance(w, dict)]
    wallet = _wallet_by_ref(wallets, body.get("walletId"), body.get("email"))
    if wallet is None:
        fail(404, "not_found", "No wallet found for this wallet ID / email.")
    spend_id = _ref_id("SPD", reference)
    spends = [dict(s) for s in (data.get("walletSpends") or []) if isinstance(s, dict)]
    existing = next((s for s in spends if s.get("id") == spend_id), None)
    if existing is not None:
        return {"success": True, "skipped": True, "reason": "already_recorded", "wallet": _wallet_view(wallet), "spend": existing}
    if wallet.get("status") in {"Frozen", "Flagged"}:
        fail(409, "wallet_blocked", f"This wallet is {wallet['status'].lower()} and cannot spend.")
    balance = float(wallet.get("balance") or 0)
    if amount > balance + 1e-9:
        fail(409, "insufficient_balance", f"Insufficient wallet balance (available {_money_label(balance)}).")

    at = _now()
    iso = at[:10]
    income_ledger = f"{category} Sales"
    label = _money_label(amount)
    voucher_no = f"WS-{spend_id[4:16]}"
    base = {
        "date": _ist_now().strftime("%d %b %Y"),
        "dateIso": iso,
        "voucherNo": voucher_no,
        "description": f"Wallet spend — {vendor} ({wallet.get('walletId')})",
        "balance": label,
        "referenceModule": "Accounting",
        "sourceModule": "WALLET",
        "sourceTransactionId": spend_id,
        "referenceNo": reference,
        "voucherType": "Journal",
        "department": category,
        "financialYear": "2026–27",
        "status": "Posted",
    }
    gl = list(data.get("glEntries") or [])
    gl[0:0] = [
        {**base, "id": f"GL-{spend_id}-DR", "ledgerAccount": WALLET_LIABILITY, "debit": label, "credit": "—"},
        {**base, "id": f"GL-{spend_id}-CR", "ledgerAccount": income_ledger, "debit": "—", "credit": label},
    ]
    data["glEntries"] = gl
    balanced, debit_total, credit_total = _gl_amounts_balanced(data, spend_id)
    if not balanced:
        fail(500, "accounting_imbalance", f"Wallet spend GL not balanced ({debit_total} vs {credit_total}).")

    spend = {
        "id": spend_id,
        "walletId": wallet["walletId"],
        "amount": amount,
        "category": category,
        "vendor": vendor,
        "reference": reference,
        "at": at,
        "createdBy": actor.email,
    }
    spends.insert(0, spend)
    data["walletSpends"] = spends
    wallet["balance"] = round(balance - amount, 2)
    wallets[wallets.index(next(w for w in wallets if w.get("walletId") == wallet["walletId"]))] = wallet
    data["wallets"] = wallets

    fin.persist_state(db, actor, {"data": data}, commit=False, audit_action="FINANCE_WALLET_SPEND_STATE")
    write_audit(
        db, action="finance.wallet.spend", entity_type="finance_wallet", entity_id=wallet["walletId"],
        actor_id=actor.id, campus_id=actor.campus_id,
        details=f"amount={amount};category={category};ref={reference[:40]}",
    )
    db.commit()
    return {"success": True, "skipped": False, "wallet": _wallet_view(wallet), "spend": spend, "glBalanced": True}


def set_wallet_status(db: Session, actor: User, payload: dict) -> dict:
    _require_role(db, actor)
    body = payload or {}
    status = str(body.get("status") or "").strip().title()
    if status not in _STATUSES:
        fail(400, "validation_error", "status must be Active, Frozen or Flagged.")
    reason = str(body.get("reason") or "").strip()
    if status != "Active" and not reason:
        fail(400, "validation_error", "A reason is required to freeze or flag a wallet.")

    data = dict(fin.get_state(db, actor)["data"])
    wallets = [dict(w) for w in (data.get("wallets") or []) if isinstance(w, dict)]
    wallet = _wallet_by_ref(wallets, body.get("walletId"), body.get("email"))
    if wallet is None:
        fail(404, "not_found", "No wallet found for this wallet ID / email.")
    if (wallet.get("status") or "Active") == status:
        return {"success": True, "skipped": True, "reason": "unchanged", "wallet": _wallet_view(wallet)}
    previous = wallet.get("status") or "Active"
    wallet["status"] = status
    wallet["statusReason"] = reason
    wallet["statusChangedAt"] = _now()
    wallet["statusChangedBy"] = actor.email
    wallets[wallets.index(next(w for w in wallets if w.get("walletId") == wallet["walletId"]))] = wallet
    data["wallets"] = wallets
    fin.persist_state(db, actor, {"data": data}, commit=False, audit_action="FINANCE_WALLET_STATUS_STATE")
    write_audit(
        db, action="finance.wallet.status", entity_type="finance_wallet", entity_id=wallet["walletId"],
        actor_id=actor.id, campus_id=actor.campus_id, details=f"{previous}->{status};reason={reason[:80]}",
    )
    db.commit()
    return {"success": True, "skipped": False, "wallet": _wallet_view(wallet)}
