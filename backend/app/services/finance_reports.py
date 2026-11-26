"""Finance reports pack — overview, income/expense breakdown, fee comparison and trends from live campus collections."""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models import User
from app.services import finance as fin
from app.services.finance_accounting import _gl_rows, _guess_type, _key, _money_label, _require_campus, _type_map
from app.services.finance_actions import _live_payable, _now, _parse_iso_date, _parse_money
from app.services.finance_settings import current_fy_label, fy_bounds, fy_label

_MONTHS = ("Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar")


def _pct(part: float, whole: float) -> float:
    return round((part / whole) * 100, 1) if whole else 0.0


def _ledger_flows(data: dict, start: date, end: date):
    """Yield (account_type, account_name, month_index, amount) where amount is income-positive or expense-positive."""
    types = _type_map([r for r in (data.get("chartOfAccounts") or []) if isinstance(r, dict)])
    for row in _gl_rows(data, date_from=start, date_to=end):
        name = str(row.get("ledgerAccount") or "").strip()
        if not name:
            continue
        account_type = types.get(_key(name)) or _guess_type(name)
        if account_type not in {"Income", "Expense"}:
            continue
        parsed = _parse_iso_date(row.get("dateIso") or row.get("date"))
        if parsed is None:
            continue
        debit, credit = _parse_money(row.get("debit")), _parse_money(row.get("credit"))
        amount = credit - debit if account_type == "Income" else debit - credit
        yield account_type, name, (parsed.month - 4) % 12, amount


def _breakdown(totals: dict[str, float]) -> list[dict]:
    whole = sum(v for v in totals.values() if v > 0)
    rows = [
        {"category": name, "amountValue": round(value, 2), "amount": _money_label(value), "percentValue": _pct(value, whole), "percent": f"{_pct(value, whole)}%"}
        for name, value in totals.items()
        if abs(value) > 0.004
    ]
    return sorted(rows, key=lambda r: -r["amountValue"])


def _fee_stats(data: dict, year: str) -> dict:
    fine_rules = [r for r in (data.get("fineRules") or []) if isinstance(r, dict)]
    stats = {"academicYear": year, "totalDemand": 0.0, "totalConcession": 0.0, "netDemand": 0.0, "collected": 0.0, "outstanding": 0.0, "fineCollected": 0.0, "defaulters": 0, "installmentCount": 0}
    owing: set[str] = set()
    for row in data.get("installments") or []:
        if not isinstance(row, dict):
            continue
        if not _same_year(row.get("academicYear"), year):
            continue
        status = str(row.get("status") or "").upper()
        if status == "CANCELLED":
            continue
        fine, net, balance = _live_payable(row, fine_rules)
        paid = float(row.get("paidAmount") or 0)
        stats["installmentCount"] += 1
        stats["totalDemand"] += float(row.get("feeAmount") or 0)
        stats["totalConcession"] += float(row.get("concessionAmount") or 0)
        stats["netDemand"] += net
        stats["collected"] += paid
        if status != "WAIVED":
            stats["outstanding"] += balance
            if balance > 0:
                owing.add(str(row.get("studentId") or ""))
        if paid > 0 and fine > 0:
            stats["fineCollected"] += min(fine, paid)
    stats["defaulters"] = len(owing)
    return {k: (round(v, 2) if isinstance(v, float) else v) for k, v in stats.items()}


def _same_year(raw, year: str) -> bool:
    text = str(raw or "").replace("–", "-").strip()
    if not text:
        return False
    start = text[:4]
    return start.isdigit() and start == year[:4]


def report_pack(db: Session, actor: User, financial_year: str | None = None) -> dict:
    _require_campus(actor)
    data = fin.get_state(db, actor)["data"]
    year = (financial_year or current_fy_label(data)).replace("–", "-").replace("FY", "").strip()
    start, end = fy_bounds(year)
    prev_year = fy_label(date(start.year - 1, 4, 1))
    prev_start, prev_end = fy_bounds(prev_year)

    income_by: dict[str, float] = {}
    expense_by: dict[str, float] = {}
    income_month = [0.0] * 12
    expense_month = [0.0] * 12
    for account_type, name, month, amount in _ledger_flows(data, start, end):
        if account_type == "Income":
            income_by[name] = income_by.get(name, 0.0) + amount
            income_month[month] += amount
        else:
            expense_by[name] = expense_by.get(name, 0.0) + amount
            expense_month[month] += amount
    prev_income = prev_expense = 0.0
    for account_type, _name, _month, amount in _ledger_flows(data, prev_start, prev_end):
        if account_type == "Income":
            prev_income += amount
        else:
            prev_expense += amount

    total_income = round(sum(income_month), 2)
    total_expense = round(sum(expense_month), 2)
    net = round(total_income - total_expense, 2)
    current_fees = _fee_stats(data, year)
    previous_fees = _fee_stats(data, prev_year)
    efficiency = _pct(current_fees["collected"], current_fees["netDemand"])

    active = [i for i in range(12) if income_month[i] or expense_month[i]]
    last3 = active[-3:]
    surplus3 = round(sum(income_month[i] - expense_month[i] for i in last3) / len(last3), 2) if last3 else 0.0
    peak_spend = max(range(12), key=lambda i: expense_month[i]) if any(expense_month) else None
    peak_income = max(range(12), key=lambda i: income_month[i]) if any(income_month) else None
    scale = max(total_income, total_expense, prev_income, prev_expense, 1.0)

    return {
        "success": True,
        "generatedAt": _now(),
        "financialYear": year,
        "previousFinancialYear": prev_year,
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "source": "Posted GL entries and fee installments on the campus finance snapshot",
        "overview": {
            "totalIncome": total_income,
            "totalExpense": total_expense,
            "netSurplus": net,
            "collectionEfficiency": efficiency,
            "cards": [
                {"label": "Total Income (YTD)", "value": _money_label(total_income), "sub": f"FY {year} · posted GL", "iconTone": "success"},
                {"label": "Total Expenditure (YTD)", "value": _money_label(total_expense), "sub": f"FY {year} · posted GL", "iconTone": "danger"},
                {"label": "Net Surplus", "value": _money_label(net), "sub": f"{_pct(net, total_income)}% margin" if total_income else "No income posted", "subTone": "success" if net >= 0 else "danger", "iconTone": "success" if net >= 0 else "danger"},
                {"label": "Fee Collection Efficiency", "value": f"{efficiency}%", "sub": "collected of net fee demand", "iconTone": "info"},
            ],
            "trend": {"labels": list(_MONTHS), "income": [round(v, 2) for v in income_month], "expenditure": [round(v, 2) for v in expense_month]},
            "revenueBreakdown": [{"name": r["category"], "percent": r["percentValue"], "amount": r["amountValue"]} for r in _breakdown(income_by)],
        },
        "income": {"breakdown": _breakdown(income_by), "total": total_income},
        "expenditure": {"breakdown": _breakdown(expense_by), "total": total_expense},
        "feeComparison": {"current": current_fees, "previous": previous_fees},
        "trends": {
            "cards": [
                {"label": "3-Month Avg. Surplus", "value": _money_label(surplus3), "sub": f"last {len(last3)} active month(s)" if last3 else "no posted months", "iconTone": "success" if surplus3 >= 0 else "danger"},
                {"label": "Highest Spend Month", "value": _MONTHS[peak_spend] if peak_spend is not None else "—", "sub": f"{_money_label(expense_month[peak_spend])} outflow" if peak_spend is not None else "no expenses posted", "subTone": "danger", "iconTone": "danger"},
                {"label": "Collection Peak", "value": _MONTHS[peak_income] if peak_income is not None else "—", "sub": f"{_money_label(income_month[peak_income])} inflow" if peak_income is not None else "no income posted", "subTone": "success", "iconTone": "success"},
                {"label": "Active Months", "value": str(len(active)), "sub": f"months with postings in FY {year}", "iconTone": "info"},
            ],
            "yearOnYear": [
                {"label": f"Income — {prev_year}", "amount": _money_label(prev_income), "value": round(prev_income / scale * 100, 1), "tone": "in"},
                {"label": f"Income — {year}", "amount": _money_label(total_income), "value": round(total_income / scale * 100, 1), "tone": "in"},
                {"label": f"Expenditure — {prev_year}", "amount": _money_label(prev_expense), "value": round(prev_expense / scale * 100, 1), "tone": "out"},
                {"label": f"Expenditure — {year}", "amount": _money_label(total_expense), "value": round(total_expense / scale * 100, 1), "tone": "out"},
            ],
        },
    }
