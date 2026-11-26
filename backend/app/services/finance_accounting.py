"""Accounting (chart of accounts, journal vouchers, bank reconciliation, statements) — live on campus finance snapshot."""

from __future__ import annotations

import re
from datetime import date

from sqlalchemy.orm import Session

from app.deps import role_code_for
from app.models import User
from app.services import finance as fin
from app.services.audit import write_audit
from app.services.errors import fail
from app.services.finance_actions import (
    _display_date,
    _gl_amounts_balanced,
    _now,
    _parse_iso_date,
    _parse_money,
)

_ACCOUNT_TYPES = ("Asset", "Liability", "Income", "Expense", "Equity")
_WRITE_ROLES = {"accounthead", "finance", "financeassistant", "finance_assistant", "admin", "superadmin"}
_POST_ROLES = {"accounthead", "finance", "admin", "superadmin"}
_CASH_BANK_HINTS = ("cash", "bank")


def _money_label(amount: float) -> str:
    value = round(float(amount or 0), 2)
    if abs(value - round(value)) < 0.005:
        return f"₹{int(round(value)):,}"
    return f"₹{value:,.2f}"


def _key(name) -> str:
    return re.sub(r"\s+", " ", str(name or "").strip()).lower()


def _require_campus(actor: User) -> None:
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")


def _require_role(db: Session, actor: User, allowed: set[str], what: str) -> None:
    if role_code_for(db, actor) not in allowed:
        fail(403, "forbidden", f"Not allowed to {what}.")


def _guess_type(name: str) -> str:
    n = _key(name)
    if any(w in n for w in ("income", "donation", "grant", "revenue", "interest received", " sales")):
        return "Income"
    if any(w in n for w in ("payable", "liabilit", "tds", "advance received", "fee advance", "deposit received", "caution")):
        return "Liability"
    if any(w in n for w in ("capital", "reserve", "retained", "equity", "surplus")):
        return "Equity"
    if any(w in n for w in ("cash", "bank", "receivable", "prepaid", "wallet float", "fixed asset", "equipment", "stock")):
        return "Asset"
    return "Expense"


def _type_map(accounts: list[dict]) -> dict[str, str]:
    return {
        _key(row.get("accountName")): str(row.get("accountType") or "")
        for row in accounts
        if isinstance(row, dict) and row.get("accountName") and row.get("accountType")
    }


def _gl_rows(data: dict, date_from: date | None = None, date_to: date | None = None, department: str | None = None):
    for row in data.get("glEntries") or []:
        if not isinstance(row, dict):
            continue
        if str(row.get("status") or "Posted").lower() in {"draft", "void", "voided"}:
            continue
        if date_from or date_to:
            parsed = _parse_iso_date(row.get("dateIso") or row.get("date"))
            if parsed is None:
                continue
            if date_from and parsed < date_from:
                continue
            if date_to and parsed > date_to:
                continue
        if department and department != "All Departments" and str(row.get("department") or "") != department:
            continue
        yield row


def _movements(data: dict, **filters) -> dict[str, dict]:
    totals: dict[str, dict] = {}
    for row in _gl_rows(data, **filters):
        name = str(row.get("ledgerAccount") or "").strip()
        if not name:
            continue
        slot = totals.setdefault(_key(name), {"name": name, "debit": 0.0, "credit": 0.0})
        slot["debit"] += _parse_money(row.get("debit"))
        slot["credit"] += _parse_money(row.get("credit"))
    return totals


def _natural_balance(account_type: str, opening: float, debit: float, credit: float) -> float:
    if account_type in {"Asset", "Expense"}:
        return opening + debit - credit
    return opening + credit - debit


# ───────────────────────── Chart of accounts ─────────────────────────


def list_chart_of_accounts(db: Session, actor: User) -> dict:
    _require_campus(actor)
    data = fin.get_state(db, actor)["data"]
    stored = [row for row in (data.get("chartOfAccounts") or []) if isinstance(row, dict)]
    moves = _movements(data)
    accounts = []
    seen = set()
    for row in stored:
        name_key = _key(row.get("accountName"))
        seen.add(name_key)
        move = moves.get(name_key, {"debit": 0.0, "credit": 0.0})
        account_type = str(row.get("accountType") or _guess_type(row.get("accountName")))
        balance = _natural_balance(
            account_type, float(row.get("openingBalance") or 0), move["debit"], move["credit"]
        )
        accounts.append({**row, "balanceAmount": round(balance, 2), "balance": _money_label(balance), "derived": False})
    derived = 0
    for name_key, move in moves.items():
        if name_key in seen:
            continue
        derived += 1
        account_type = _guess_type(move["name"])
        balance = _natural_balance(account_type, 0.0, move["debit"], move["credit"])
        accounts.append(
            {
                "id": f"LEDGER-{derived:03d}",
                "accountCode": "—",
                "accountName": move["name"],
                "accountType": account_type,
                "parentAccount": "—",
                "status": "Active",
                "openingBalance": 0,
                "balanceAmount": round(balance, 2),
                "balance": _money_label(balance),
                "derived": True,
            }
        )
    return {"success": True, "accounts": accounts, "accountCount": len(accounts), "derivedCount": derived}


def upsert_account(db: Session, actor: User, payload: dict) -> dict:
    _require_role(db, actor, _WRITE_ROLES, "manage the chart of accounts")
    _require_campus(actor)
    body = payload or {}
    code = str(body.get("accountCode") or "").strip()
    name = str(body.get("accountName") or "").strip()
    account_type = str(body.get("accountType") or "").strip().title()
    if not code:
        fail(400, "validation_error", "accountCode is required.")
    if not name:
        fail(400, "validation_error", "accountName is required.")
    if account_type not in _ACCOUNT_TYPES:
        fail(400, "validation_error", f"accountType must be one of {', '.join(_ACCOUNT_TYPES)}.")
    status = str(body.get("status") or "Active").title()
    if status not in {"Active", "Inactive"}:
        fail(400, "validation_error", "status must be Active or Inactive.")
    try:
        opening = float(body.get("openingBalance") or 0)
    except (TypeError, ValueError):
        fail(400, "validation_error", "openingBalance must be a number.")

    data = dict(fin.get_state(db, actor)["data"])
    accounts = [dict(row) for row in (data.get("chartOfAccounts") or []) if isinstance(row, dict)]
    account_id = f"COA-{re.sub(r'[^A-Za-z0-9]+', '-', code).strip('-')}"[:48]
    existing = next((row for row in accounts if row.get("id") == account_id), None)
    for row in accounts:
        if row is existing:
            continue
        if _key(row.get("accountName")) == _key(name):
            fail(409, "conflict", f"Account name '{name}' is already used by code {row.get('accountCode')}.")

    record = {
        "id": account_id,
        "accountCode": code,
        "accountName": name,
        "accountType": account_type,
        "parentAccount": str(body.get("parentAccount") or "—"),
        "status": status,
        "openingBalance": opening if existing is None or "openingBalance" in body else existing.get("openingBalance", 0),
        "updatedAt": _now(),
        "updatedBy": actor.email,
    }
    if existing is None:
        record["createdAt"] = _now()
        record["createdBy"] = actor.email
        accounts.insert(0, record)
    else:
        record["createdAt"] = existing.get("createdAt")
        record["createdBy"] = existing.get("createdBy")
        accounts[accounts.index(existing)] = record
    data["chartOfAccounts"] = accounts
    fin.persist_state(db, actor, {"data": data}, commit=False, audit_action="FINANCE_COA_STATE")
    write_audit(
        db,
        action="finance.coa.upsert",
        entity_type="finance_account",
        entity_id=account_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"code={code};type={account_type};status={status}",
    )
    db.commit()
    return {"success": True, "account": record, "created": existing is None}


# ───────────────────────── Journal vouchers ─────────────────────────


def _jv_view(row: dict) -> dict:
    return {**row}


def list_journal_vouchers(db: Session, actor: User) -> dict:
    _require_campus(actor)
    data = fin.get_state(db, actor)["data"]
    vouchers = [_jv_view(row) for row in (data.get("journalVouchers") or []) if isinstance(row, dict)]
    return {
        "success": True,
        "vouchers": vouchers,
        "counts": {
            "total": len(vouchers),
            "draft": sum(1 for r in vouchers if r.get("status") == "Draft"),
            "posted": sum(1 for r in vouchers if r.get("status") == "Posted"),
            "pending": sum(1 for r in vouchers if r.get("status") == "Pending Approval"),
        },
    }


def _normalize_lines(body: dict) -> list[dict]:
    raw = body.get("lines")
    lines: list[dict] = []
    if isinstance(raw, list) and raw:
        for item in raw:
            if not isinstance(item, dict):
                fail(400, "validation_error", "Each journal line must be an object.")
            try:
                debit = round(float(item.get("debit") or 0), 2)
                credit = round(float(item.get("credit") or 0), 2)
            except (TypeError, ValueError):
                fail(400, "validation_error", "Journal line amounts must be numbers.")
            account = str(item.get("account") or item.get("ledgerAccount") or "").strip()
            lines.append({"account": account, "debit": debit, "credit": credit})
    else:
        debit_account = str(body.get("debitAccount") or "").strip()
        credit_account = str(body.get("creditAccount") or "").strip()
        try:
            amount = round(float(body.get("amount") or 0), 2)
        except (TypeError, ValueError):
            fail(400, "validation_error", "amount must be a number.")
        lines = [
            {"account": debit_account, "debit": amount, "credit": 0.0},
            {"account": credit_account, "debit": 0.0, "credit": amount},
        ]
    return lines


def create_journal_voucher(db: Session, actor: User, payload: dict) -> dict:
    _require_role(db, actor, _WRITE_ROLES, "create journal vouchers")
    _require_campus(actor)
    body = payload or {}
    description = str(body.get("description") or body.get("narration") or "").strip()
    if not description:
        fail(400, "validation_error", "description is required.")
    lines = _normalize_lines(body)
    if len(lines) < 2:
        fail(400, "validation_error", "A journal voucher needs at least two lines.")
    for line in lines:
        if not line["account"]:
            fail(400, "validation_error", "Every journal line needs an account.")
        if line["debit"] < 0 or line["credit"] < 0:
            fail(400, "validation_error", "Journal line amounts cannot be negative.")
        if (line["debit"] > 0) == (line["credit"] > 0):
            fail(400, "validation_error", "Each journal line must carry either a debit or a credit.")
    debit_total = round(sum(line["debit"] for line in lines), 2)
    credit_total = round(sum(line["credit"] for line in lines), 2)
    if debit_total <= 0:
        fail(400, "validation_error", "Journal amount must be greater than zero.")
    if abs(debit_total - credit_total) >= 0.01:
        fail(400, "unbalanced_voucher", f"Debits ({debit_total}) must equal credits ({credit_total}).")
    if len({_key(line["account"]) for line in lines if line["debit"] > 0} & {_key(line["account"]) for line in lines if line["credit"] > 0}):
        fail(400, "validation_error", "The same account cannot be both debited and credited.")

    iso = str(body.get("dateIso") or body.get("date") or _now()[:10])[:10]
    parsed = _parse_iso_date(iso)
    if parsed is None:
        fail(400, "validation_error", "date must be YYYY-MM-DD.")

    data = dict(fin.get_state(db, actor)["data"])
    coa = {_key(r.get("accountName")): r for r in (data.get("chartOfAccounts") or []) if isinstance(r, dict)}
    for line in lines:
        stored = coa.get(_key(line["account"]))
        if stored and str(stored.get("status") or "Active") == "Inactive":
            fail(400, "validation_error", f"Account '{line['account']}' is inactive.")

    vouchers = [dict(row) for row in (data.get("journalVouchers") or []) if isinstance(row, dict)]
    voucher_no = str(body.get("voucherNo") or "").strip()
    if voucher_no:
        existing = next((row for row in vouchers if str(row.get("voucherNo")) == voucher_no), None)
        if existing is not None:
            return {"success": True, "skipped": True, "reason": "already_exists", "voucher": existing}
    else:
        used = [
            int(m.group(1))
            for row in vouchers
            if (m := re.search(r"-(\d+)$", str(row.get("voucherNo") or "")))
        ]
        voucher_no = f"JV-{parsed.year}-{(max(used) + 1 if used else 1):04d}"
    voucher_id = f"JV-{re.sub(r'[^A-Za-z0-9]+', '-', voucher_no).strip('-')}"[:48]

    first_debit = next(line for line in lines if line["debit"] > 0)
    first_credit = next(line for line in lines if line["credit"] > 0)
    label = _money_label(debit_total)
    voucher = {
        "id": voucher_id,
        "voucherNo": voucher_no,
        "date": _display_date(iso),
        "dateIso": iso,
        "description": description,
        "debit": f"{first_debit['account']} · {_money_label(first_debit['debit'])}"
        + (f" (+{sum(1 for l in lines if l['debit'] > 0) - 1} more)" if sum(1 for l in lines if l["debit"] > 0) > 1 else ""),
        "credit": f"{first_credit['account']} · {_money_label(first_credit['credit'])}"
        + (f" (+{sum(1 for l in lines if l['credit'] > 0) - 1} more)" if sum(1 for l in lines if l["credit"] > 0) > 1 else ""),
        "debitAccount": first_debit["account"],
        "creditAccount": first_credit["account"],
        "amount": label,
        "amountValue": debit_total,
        "lines": lines,
        "status": "Draft",
        "createdBy": actor.email,
        "createdAt": _now(),
        "remarks": str(body.get("remarks") or "").strip(),
        "campusId": str(actor.campus_id),
    }
    vouchers.insert(0, voucher)
    data["journalVouchers"] = vouchers
    fin.persist_state(db, actor, {"data": data}, commit=False, audit_action="FINANCE_JV_STATE")
    write_audit(
        db,
        action="finance.journal_voucher.create",
        entity_type="finance_journal_voucher",
        entity_id=voucher_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"voucher={voucher_no};amount={debit_total}",
    )
    db.commit()
    return {"success": True, "skipped": False, "voucher": voucher}


def post_journal_voucher(db: Session, actor: User, payload: dict) -> dict:
    _require_role(db, actor, _POST_ROLES, "post journal vouchers")
    _require_campus(actor)
    voucher_id = str((payload or {}).get("voucherId") or (payload or {}).get("id") or "").strip()
    if not voucher_id:
        fail(400, "validation_error", "voucherId is required.")

    data = dict(fin.get_state(db, actor)["data"])
    vouchers = [dict(row) for row in (data.get("journalVouchers") or []) if isinstance(row, dict)]
    voucher = next((row for row in vouchers if row.get("id") == voucher_id), None)
    if voucher is None:
        fail(404, "not_found", "Journal voucher not found.")
    if voucher.get("status") == "Posted":
        return {"success": True, "skipped": True, "reason": "already_posted", "voucher": voucher}

    gl_entries = list(data.get("glEntries") or [])
    if any(str((row or {}).get("sourceTransactionId") or "") == voucher_id for row in gl_entries):
        fail(409, "conflict", "Ledger lines already exist for this voucher.")

    iso = voucher.get("dateIso") or _now()[:10]
    new_rows = []
    for index, line in enumerate(voucher.get("lines") or []):
        new_rows.append(
            {
                "id": f"GL-{voucher_id}-{index + 1}",
                "date": voucher.get("date") or _display_date(iso),
                "dateIso": iso,
                "voucherNo": voucher.get("voucherNo"),
                "ledgerAccount": line["account"],
                "description": voucher.get("description"),
                "debit": _money_label(line["debit"]) if line["debit"] > 0 else "—",
                "credit": _money_label(line["credit"]) if line["credit"] > 0 else "—",
                "balance": _money_label(line["debit"] or line["credit"]),
                "referenceModule": "Accounting",
                "sourceModule": "JOURNAL",
                "sourceTransactionId": voucher_id,
                "referenceNo": voucher.get("voucherNo"),
                "voucherType": "Journal",
                "department": "Accounting",
                "financialYear": "2026–27",
                "status": "Posted",
            }
        )
    data["glEntries"] = new_rows + gl_entries
    balanced, debit_total, credit_total = _gl_amounts_balanced(data, voucher_id)
    if not balanced:
        fail(500, "accounting_imbalance", f"Journal GL not balanced ({debit_total} vs {credit_total}).")

    voucher["status"] = "Posted"
    voucher["postedAt"] = _now()
    voucher["postedBy"] = actor.email
    vouchers[vouchers.index(next(r for r in vouchers if r.get("id") == voucher_id))] = voucher
    data["journalVouchers"] = vouchers
    fin.persist_state(db, actor, {"data": data}, commit=False, audit_action="FINANCE_JV_POST_STATE")
    write_audit(
        db,
        action="finance.journal_voucher.post",
        entity_type="finance_journal_voucher",
        entity_id=voucher_id[:64],
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"voucher={voucher.get('voucherNo')};debit={debit_total};credit={credit_total}",
    )
    db.commit()
    return {"success": True, "skipped": False, "voucher": voucher, "glBalanced": True, "debitTotal": debit_total}


# ───────────────────────── Bank reconciliation ─────────────────────────


def _bank_amount(row: dict) -> tuple[float, str]:
    deposit = _parse_money(row.get("deposit"))
    withdrawal = _parse_money(row.get("withdrawal"))
    if deposit > 0:
        return deposit, "Deposit"
    return withdrawal, "Withdrawal"


def _recon_items(data: dict) -> list[dict]:
    stored = {
        str(row.get("entryId")): row
        for row in (data.get("reconciliationItems") or [])
        if isinstance(row, dict) and row.get("entryId")
    }
    items = []
    for row in data.get("bankBookEntries") or []:
        if not isinstance(row, dict) or not row.get("id"):
            continue
        entry_id = str(row["id"])
        amount, direction = _bank_amount(row)
        done = stored.get(entry_id)
        iso = str(row.get("dateIso") or "")[:10]
        voucher = row.get("voucher") or "—"
        bank = row.get("account") or row.get("bank") or "Bank"
        if done:
            bank_amount = float(done.get("bankAmount") or 0)
            difference = round(abs(amount - bank_amount), 2)
            status = done.get("status") or ("Matched" if difference < 0.01 else "Pending Reconciliation")
        else:
            bank_amount = None
            difference = amount
            status = "Unmatched"
        items.append(
            {
                "id": f"BRC-{entry_id}",
                "entryId": entry_id,
                "date": _display_date(iso) if iso else str(row.get("date") or "—"),
                "dateIso": iso,
                "voucher": voucher,
                "erpAmount": _money_label(amount),
                "erpAmountValue": amount,
                "bankAmount": _money_label(bank_amount) if bank_amount is not None else "—",
                "difference": _money_label(difference),
                "status": status,
                "bank": bank,
                "direction": direction,
                "detail": {
                    "erpEntry": {
                        "date": _display_date(iso) if iso else row.get("date"),
                        "voucher": voucher,
                        "description": row.get("description"),
                        "amount": _money_label(amount),
                    },
                    "bankEntry": (
                        {
                            "date": _display_date(str(done.get("reconciledAt") or "")[:10]),
                            "reference": done.get("statementRef") or "—",
                            "description": done.get("note") or "Bank statement line",
                            "amount": _money_label(bank_amount or 0),
                        }
                        if done
                        else None
                    ),
                    "suggestions": [],
                },
            }
        )
    return items


def list_reconciliation(db: Session, actor: User) -> dict:
    _require_campus(actor)
    data = fin.get_state(db, actor)["data"]
    items = _recon_items(data)
    return {
        "success": True,
        "items": items,
        "counts": {
            "total": len(items),
            "matched": sum(1 for r in items if r["status"] == "Matched"),
            "unmatched": sum(1 for r in items if r["status"] == "Unmatched"),
            "pending": sum(1 for r in items if r["status"] == "Pending Reconciliation"),
        },
    }


def reconcile_entry(db: Session, actor: User, payload: dict) -> dict:
    _require_role(db, actor, _POST_ROLES, "reconcile bank entries")
    _require_campus(actor)
    body = payload or {}
    raw_id = str(body.get("entryId") or body.get("id") or "").strip()
    entry_id = raw_id[4:] if raw_id.startswith("BRC-") else raw_id
    if not entry_id:
        fail(400, "validation_error", "entryId is required.")
    statement_ref = str(body.get("statementRef") or "").strip()
    if not statement_ref:
        fail(400, "validation_error", "statementRef (bank statement reference) is required.")
    try:
        bank_amount = round(float(body.get("bankAmount")), 2)
    except (TypeError, ValueError):
        fail(400, "validation_error", "bankAmount must be a number.")
    if bank_amount <= 0:
        fail(400, "validation_error", "bankAmount must be greater than zero.")

    data = dict(fin.get_state(db, actor)["data"])
    entries = [r for r in (data.get("bankBookEntries") or []) if isinstance(r, dict)]
    entry = next((r for r in entries if str(r.get("id")) == entry_id), None)
    if entry is None:
        fail(404, "not_found", "Bank book entry not found.")
    stored = [dict(r) for r in (data.get("reconciliationItems") or []) if isinstance(r, dict)]
    existing = next((r for r in stored if str(r.get("entryId")) == entry_id), None)
    if existing and existing.get("status") == "Matched":
        return {"success": True, "skipped": True, "reason": "already_matched", "item": next(i for i in _recon_items(data) if i["entryId"] == entry_id)}

    erp_amount, _ = _bank_amount(entry)
    difference = round(abs(erp_amount - bank_amount), 2)
    status = "Matched" if difference < 0.01 else "Pending Reconciliation"
    record = {
        "id": f"BRC-{entry_id}",
        "entryId": entry_id,
        "status": status,
        "bankAmount": bank_amount,
        "difference": difference,
        "statementRef": statement_ref,
        "note": str(body.get("note") or "").strip(),
        "reconciledAt": _now(),
        "reconciledBy": actor.email,
    }
    if existing:
        stored[stored.index(existing)] = record
    else:
        stored.insert(0, record)
    data["reconciliationItems"] = stored
    fin.persist_state(db, actor, {"data": data}, commit=False, audit_action="FINANCE_RECON_STATE")
    write_audit(
        db,
        action="finance.bank_reconciliation.match",
        entity_type="finance_bank_entry",
        entity_id=entry_id[:64],
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"status={status};erp={erp_amount};bank={bank_amount};ref={statement_ref}",
    )
    db.commit()
    return {
        "success": True,
        "skipped": False,
        "status": status,
        "difference": difference,
        "item": next(i for i in _recon_items(data) if i["entryId"] == entry_id),
    }


# ───────────────────────── Financial statements ─────────────────────────


def _amount_cell(value: float) -> str:
    return f"{value:,.0f}" if abs(value - round(value)) < 0.005 else f"{value:,.2f}"


def financial_statements(
    db: Session,
    actor: User,
    date_from: str | None = None,
    date_to: str | None = None,
    department: str | None = None,
) -> dict:
    _require_campus(actor)
    start = _parse_iso_date(date_from) if date_from else None
    end = _parse_iso_date(date_to) if date_to else None
    if date_from and start is None or date_to and end is None:
        fail(400, "validation_error", "dateFrom/dateTo must be YYYY-MM-DD.")
    if start and end and start > end:
        fail(400, "validation_error", "dateFrom must not be after dateTo.")

    data = fin.get_state(db, actor)["data"]
    coa = [r for r in (data.get("chartOfAccounts") or []) if isinstance(r, dict)]
    types = _type_map(coa)
    openings = {_key(r.get("accountName")): float(r.get("openingBalance") or 0) for r in coa}
    moves = _movements(data, date_from=start, date_to=end, department=department)

    names = {k: v["name"] for k, v in moves.items()}
    for row in coa:
        if openings.get(_key(row.get("accountName"))):
            names.setdefault(_key(row.get("accountName")), str(row.get("accountName")))

    accounts = []
    for name_key, name in sorted(names.items(), key=lambda kv: kv[1].lower()):
        move = moves.get(name_key, {"debit": 0.0, "credit": 0.0})
        account_type = types.get(name_key) or _guess_type(name)
        net = move["debit"] - move["credit"]
        opening = openings.get(name_key, 0.0)
        # Debit-positive balance including the stored opening balance.
        signed = net + (opening if account_type in {"Asset", "Expense"} else -opening)
        accounts.append(
            {
                "name": name,
                "type": account_type,
                "debit": move["debit"],
                "credit": move["credit"],
                "net": net,
                "signed": signed,
                "opening": opening,
            }
        )

    tb_rows = []
    tb_debit = tb_credit = 0.0
    for index, acct in enumerate(accounts, start=1):
        debit_side = max(acct["signed"], 0.0)
        credit_side = max(-acct["signed"], 0.0)
        tb_debit += debit_side
        tb_credit += credit_side
        tb_rows.append(
            {
                "id": f"TB-{index:03d}",
                "account": acct["name"],
                "debit": _money_label(debit_side) if debit_side else "—",
                "credit": _money_label(credit_side) if credit_side else "—",
                "debitValue": debit_side,
                "creditValue": credit_side,
                "department": department or "All Departments",
                "campus": "Current campus",
            }
        )

    income = [(a["name"], -a["net"]) for a in accounts if a["type"] == "Income" and abs(a["net"]) > 0.004]
    expense = [(a["name"], a["net"]) for a in accounts if a["type"] == "Expense" and abs(a["net"]) > 0.004]
    total_income = sum(v for _, v in income)
    total_expense = sum(v for _, v in expense)
    net_profit = total_income - total_expense

    profit_loss = [{"type": "section", "label": "Income"}]
    profit_loss += [{"type": "item", "label": n, "amount": _amount_cell(v), "indent": True} for n, v in income]
    profit_loss.append({"type": "total", "label": "Total Income", "amount": _amount_cell(total_income)})
    profit_loss.append({"type": "section", "label": "Expenses"})
    profit_loss += [{"type": "item", "label": n, "amount": _amount_cell(v), "indent": True} for n, v in expense]
    profit_loss.append({"type": "total", "label": "Total Expenses", "amount": _amount_cell(total_expense)})
    profit_loss.append(
        {"type": "net", "label": "Net Surplus / (Deficit)", "amount": _amount_cell(net_profit), "profit": net_profit >= 0}
    )

    assets = [(a["name"], a["signed"]) for a in accounts if a["type"] == "Asset"]
    liabilities = [(a["name"], -a["signed"]) for a in accounts if a["type"] == "Liability"]
    equity = [(a["name"], -a["signed"]) for a in accounts if a["type"] == "Equity"]
    total_assets = sum(v for _, v in assets)
    total_liab = sum(v for _, v in liabilities)
    total_equity = sum(v for _, v in equity) + net_profit
    balance_sheet = [{"type": "section", "label": "Assets"}]
    balance_sheet += [{"type": "item", "label": n, "amount": _amount_cell(v), "indent": True} for n, v in assets]
    balance_sheet.append({"type": "total", "label": "Total Assets", "amount": _amount_cell(total_assets)})
    balance_sheet.append({"type": "section", "label": "Liabilities"})
    balance_sheet += [{"type": "item", "label": n, "amount": _amount_cell(v), "indent": True} for n, v in liabilities]
    balance_sheet.append({"type": "total", "label": "Total Liabilities", "amount": _amount_cell(total_liab)})
    balance_sheet.append({"type": "section", "label": "Equity"})
    balance_sheet += [{"type": "item", "label": n, "amount": _amount_cell(v), "indent": True} for n, v in equity]
    balance_sheet.append(
        {"type": "item", "label": "Current period surplus / (deficit)", "amount": _amount_cell(net_profit), "indent": True}
    )
    balance_sheet.append({"type": "total", "label": "Total Equity", "amount": _amount_cell(total_equity)})

    inflow: dict[str, float] = {}
    outflow: dict[str, float] = {}
    for row in _gl_rows(data, date_from=start, date_to=end, department=department):
        if not any(h in _key(row.get("ledgerAccount")) for h in _CASH_BANK_HINTS):
            continue
        source = str(row.get("sourceModule") or "OTHER").title()
        debit = _parse_money(row.get("debit"))
        credit = _parse_money(row.get("credit"))
        if debit:
            inflow[source] = inflow.get(source, 0.0) + debit
        if credit:
            outflow[source] = outflow.get(source, 0.0) + credit
    total_in = sum(inflow.values())
    total_out = sum(outflow.values())
    cash_flow = [{"type": "section", "label": "Cash receipts"}]
    cash_flow += [{"type": "item", "label": k, "amount": _amount_cell(v), "indent": True} for k, v in sorted(inflow.items())]
    cash_flow.append({"type": "total", "label": "Total receipts", "amount": _amount_cell(total_in)})
    cash_flow.append({"type": "section", "label": "Cash payments"})
    cash_flow += [{"type": "item", "label": k, "amount": _amount_cell(v), "indent": True} for k, v in sorted(outflow.items())]
    cash_flow.append({"type": "total", "label": "Total payments", "amount": _amount_cell(total_out)})
    cash_flow.append(
        {"type": "net", "label": "Net cash movement", "amount": _amount_cell(total_in - total_out), "profit": total_in >= total_out}
    )

    return {
        "success": True,
        "generatedAt": _now(),
        "filters": {"dateFrom": date_from, "dateTo": date_to, "department": department},
        "trialBalance": {
            "rows": tb_rows,
            "totalDebit": round(tb_debit, 2),
            "totalCredit": round(tb_credit, 2),
            "balanced": abs(tb_debit - tb_credit) < 0.01,
        },
        "profitLoss": {"rows": profit_loss, "totalIncome": total_income, "totalExpense": total_expense, "net": net_profit},
        "balanceSheet": {
            "rows": balance_sheet,
            "totalAssets": total_assets,
            "totalLiabilities": total_liab,
            "totalEquity": total_equity,
            "balanced": abs(total_assets - (total_liab + total_equity)) < 0.01,
        },
        "cashFlow": {"rows": cash_flow, "totalReceipts": total_in, "totalPayments": total_out, "net": total_in - total_out},
        "accountCount": len(accounts),
    }
