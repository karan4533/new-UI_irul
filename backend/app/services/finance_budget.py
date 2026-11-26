"""Annual budget vs actual — budget lines on the campus snapshot, actuals computed from posted GL expense lines."""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.models import User
from app.services import finance as fin
from app.services.audit import write_audit
from app.services.errors import fail
from app.services.finance_accounting import (
    _POST_ROLES,
    _gl_rows,
    _guess_type,
    _key,
    _money_label,
    _require_campus,
    _require_role,
    _type_map,
)
from app.services.finance_actions import _now, _parse_money
from app.services.finance_settings import current_fy_label, fy_bounds


def _expense_lines(data: dict, start, end) -> list[dict]:
    types = _type_map([r for r in (data.get("chartOfAccounts") or []) if isinstance(r, dict)])
    out = []
    for row in _gl_rows(data, date_from=start, date_to=end):
        name = str(row.get("ledgerAccount") or "").strip()
        if not name or (types.get(_key(name)) or _guess_type(name)) != "Expense":
            continue
        out.append(
            {
                "ledger": _key(name),
                "department": _key(row.get("department")),
                "amount": _parse_money(row.get("debit")) - _parse_money(row.get("credit")),
            }
        )
    return out


def _actual_for(line: dict, expenses: list[dict]) -> float:
    ledgers = {_key(name) for name in (line.get("ledgerAccounts") or []) if str(name).strip()}
    if ledgers:
        return round(sum(e["amount"] for e in expenses if e["ledger"] in ledgers), 2)
    department = _key(line.get("department"))
    return round(sum(e["amount"] for e in expenses if e["department"] == department), 2)


def _view(line: dict, actual: float) -> dict:
    budget = float(line.get("budget") or 0)
    variance = round(budget - actual, 2)
    utilization = round((actual / budget) * 100, 1) if budget else 0.0
    return {
        **line,
        "budget": budget,
        "actual": actual,
        "actualSource": "ledgerAccounts" if line.get("ledgerAccounts") else "department",
        "balance": variance,
        "variance": variance,
        "utilization": utilization,
        "overBudget": variance < 0,
        "budgetLabel": _money_label(budget),
        "actualLabel": _money_label(actual),
    }


def list_budget(db: Session, actor: User, financial_year: str | None = None) -> dict:
    _require_campus(actor)
    data = fin.get_state(db, actor)["data"]
    current = current_fy_label(data)
    year = (financial_year or current).replace("–", "-").replace("FY", "").strip()
    start, end = fy_bounds(year)
    expenses = _expense_lines(data, start, end)
    lines = [
        row
        for row in (data.get("annualBudget") or [])
        if isinstance(row, dict) and str(row.get("financialYear") or current).replace("–", "-") == year
    ]
    rows = [_view(line, _actual_for(line, expenses)) for line in lines]
    total_budget = round(sum(r["budget"] for r in rows), 2)
    total_actual = round(sum(r["actual"] for r in rows), 2)
    years = sorted(
        {str(r.get("financialYear")).replace("–", "-") for r in (data.get("annualBudget") or []) if isinstance(r, dict) and r.get("financialYear")}
        | {year, current},
        reverse=True,
    )
    return {
        "success": True,
        "financialYear": year,
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "rows": rows,
        "years": years,
        "totals": {
            "budget": total_budget,
            "actual": total_actual,
            "variance": round(total_budget - total_actual, 2),
            "utilization": round((total_actual / total_budget) * 100, 1) if total_budget else 0.0,
            "overBudgetCount": sum(1 for r in rows if r["overBudget"]),
            "unbudgetedExpense": round(sum(e["amount"] for e in expenses) - total_actual, 2),
        },
    }


def upsert_budget_line(db: Session, actor: User, payload: dict) -> dict:
    _require_role(db, actor, _POST_ROLES, "set the annual budget")
    _require_campus(actor)
    body = payload or {}
    department = str(body.get("department") or "").strip()
    category = str(body.get("category") or "").strip()
    if not department:
        fail(400, "validation_error", "department is required.")
    if not category:
        fail(400, "validation_error", "category is required.")
    try:
        amount = round(float(body.get("budget")), 2)
    except (TypeError, ValueError):
        fail(400, "validation_error", "budget must be a number.")
    if amount < 0:
        fail(400, "validation_error", "budget cannot be negative.")
    ledgers = body.get("ledgerAccounts") or []
    if not isinstance(ledgers, list) or any(not isinstance(x, str) for x in ledgers):
        fail(400, "validation_error", "ledgerAccounts must be a list of account names.")
    ledgers = [x.strip() for x in ledgers if x.strip()]

    data = dict(fin.get_state(db, actor)["data"])
    year = str(body.get("financialYear") or current_fy_label(data)).replace("–", "-").replace("FY", "").strip()
    fy_bounds(year)
    lines = [dict(row) for row in (data.get("annualBudget") or []) if isinstance(row, dict)]
    line_id = f"BDG-{year}-{re.sub(r'[^A-Za-z0-9]+', '-', department).strip('-')}-{re.sub(r'[^A-Za-z0-9]+', '-', category).strip('-')}"[:64]
    existing = next((row for row in lines if row.get("id") == line_id), None)
    if existing is None:
        existing = next(
            (
                row
                for row in lines
                if _key(row.get("department")) == _key(department)
                and _key(row.get("category")) == _key(category)
                and str(row.get("financialYear") or year).replace("–", "-") == year
            ),
            None,
        )
        if existing is not None:
            line_id = existing.get("id") or line_id
    if existing and float(existing.get("budget") or 0) == amount and (existing.get("ledgerAccounts") or []) == ledgers and existing.get("financialYear") == year:
        return {"success": True, "skipped": True, "reason": "no_change", "line": existing}

    record = {
        "id": line_id,
        "financialYear": year,
        "department": department,
        "category": category,
        "budget": amount,
        "ledgerAccounts": ledgers,
        "updatedAt": _now(),
        "updatedBy": actor.email,
        "createdAt": (existing or {}).get("createdAt") or _now(),
        "createdBy": (existing or {}).get("createdBy") or actor.email,
    }
    if existing is None:
        lines.append(record)
    else:
        lines[lines.index(existing)] = record
    data["annualBudget"] = lines
    fin.persist_state(db, actor, {"data": data}, commit=False, audit_action="FINANCE_BUDGET_STATE")
    write_audit(
        db,
        action="finance.budget.upsert",
        entity_type="finance_budget_line",
        entity_id=line_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"year={year};dept={department};category={category};budget={amount};previous={(existing or {}).get('budget')}",
    )
    db.commit()
    return {"success": True, "skipped": False, "created": existing is None, "line": record}
