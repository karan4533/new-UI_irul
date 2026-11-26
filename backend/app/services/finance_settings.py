"""Finance settings (financial year April–March, tax identifiers, formatting) — live on campus finance snapshot."""

from __future__ import annotations

import re
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FinancialYear, User
from app.services import finance as fin
from app.services.audit import write_audit
from app.services.errors import fail
from app.services.finance_accounting import _require_campus, _require_role
from app.services.finance_actions import _now

_SETTINGS_ROLES = {"accounthead", "finance", "admin", "superadmin"}
_SETTINGS_ID = "general"
FY_START_MONTH = "April"

_GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
_PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
_TAN_RE = re.compile(r"^[A-Z]{4}[0-9]{5}[A-Z]$")
_ACADEMIC_YEAR_RE = re.compile(r"^(\d{4})[-–](\d{2})$")

_CHOICES = {
    "currency": ("₹ Indian Rupee (INR)",),
    "numberFormat": ("Indian (₹1,00,000)", "International (₹100,000)"),
    "dateFormat": ("DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY"),
    "termStructure": ("3 Terms", "2 Semesters", "Annual"),
}
_BOOKS_CLOSURE_IDS = ("lock-posted", "require-reopen-approval")

DEFAULTS = {
    "institutionName": "",
    "gstin": "",
    "pan": "",
    "tan": "",
    "tdsRatePercent": 0.0,
    "gstRatePercent": 0.0,
    "academicYear": "",
    "financialYearStart": FY_START_MONTH,
    "currency": "₹ Indian Rupee (INR)",
    "numberFormat": "Indian (₹1,00,000)",
    "dateFormat": "DD MMM YYYY",
    "termStructure": "3 Terms",
    "booksClosure": {"lock-posted": False, "require-reopen-approval": False},
}


def fy_label(day: date) -> str:
    """April–March financial year label, e.g. 2026-04-01 → '2026-27'."""
    start = day.year if day.month >= 4 else day.year - 1
    return f"{start}-{str(start + 1)[2:]}"


def fy_bounds(label: str) -> tuple[date, date]:
    match = _ACADEMIC_YEAR_RE.match(str(label or "").replace("FY", "").strip())
    if not match:
        fail(400, "validation_error", "financialYear must look like 2026-27.")
    start = int(match.group(1))
    if (start + 1) % 100 != int(match.group(2)):
        fail(400, "validation_error", "financialYear must span consecutive years, e.g. 2026-27.")
    return date(start, 4, 1), date(start + 1, 3, 31)


def _stored(data: dict) -> dict:
    rows = [row for row in (data.get("financeSettings") or []) if isinstance(row, dict)]
    return next((row for row in rows if row.get("id") == _SETTINGS_ID), {})


def current_settings(data: dict) -> dict:
    stored = _stored(data)
    merged = {**DEFAULTS, **{k: v for k, v in stored.items() if k in DEFAULTS}}
    merged["booksClosure"] = {**DEFAULTS["booksClosure"], **(stored.get("booksClosure") or {})}
    merged["financialYearStart"] = FY_START_MONTH
    if not merged["academicYear"]:
        merged["academicYear"] = fy_label(date.today())
    return merged


def current_fy_label(data: dict) -> str:
    meta = data.get("meta") or {}
    name = str(meta.get("financialYearName") or "").replace("FY", "").strip()
    if _ACADEMIC_YEAR_RE.match(name):
        return name.replace("–", "-")
    return fy_label(date.today())


def _financial_years(db: Session, campus_id) -> list[dict]:
    rows = db.scalars(
        select(FinancialYear).where(FinancialYear.campus_id == campus_id).order_by(FinancialYear.start_date.desc())
    ).all()
    return [
        {
            "id": str(row.id),
            "name": row.name,
            "startDate": row.start_date.isoformat(),
            "endDate": row.end_date.isoformat(),
            "isCurrent": bool(row.is_current),
            "isActive": bool(row.is_active),
            "aprilToMarch": row.start_date.month == 4 and row.start_date.day == 1 and row.end_date.month == 3,
        }
        for row in rows
    ]


def get_settings(db: Session, actor: User) -> dict:
    _require_campus(actor)
    data = fin.get_state(db, actor)["data"]
    stored = _stored(data)
    return {
        "success": True,
        "settings": current_settings(data),
        "currentFinancialYear": current_fy_label(data),
        "financialYears": _financial_years(db, actor.campus_id),
        "updatedAt": stored.get("updatedAt"),
        "updatedBy": stored.get("updatedBy"),
        "choices": {**{k: list(v) for k, v in _CHOICES.items()}, "financialYearStart": [FY_START_MONTH]},
    }


def _rate(value, field: str) -> float:
    try:
        rate = round(float(value), 2)
    except (TypeError, ValueError):
        fail(400, "validation_error", f"{field} must be a number.")
    if rate < 0 or rate > 100:
        fail(400, "validation_error", f"{field} must be between 0 and 100.")
    return rate


def update_settings(db: Session, actor: User, payload: dict) -> dict:
    _require_role(db, actor, _SETTINGS_ROLES, "change finance settings")
    _require_campus(actor)
    body = payload or {}
    data = dict(fin.get_state(db, actor)["data"])
    before = current_settings(data)
    after = dict(before)

    if "financialYearStart" in body and str(body["financialYearStart"]).strip() != FY_START_MONTH:
        fail(400, "validation_error", "Financial year must run April to March.")
    if "institutionName" in body:
        name = str(body["institutionName"] or "").strip()
        if not name:
            fail(400, "validation_error", "institutionName cannot be empty.")
        after["institutionName"] = name[:200]
    for field, pattern, label in (("gstin", _GSTIN_RE, "GSTIN"), ("pan", _PAN_RE, "PAN"), ("tan", _TAN_RE, "TAN")):
        if field in body:
            value = str(body[field] or "").strip().upper()
            if value and not pattern.match(value):
                fail(400, "validation_error", f"{label} format is invalid.")
            after[field] = value
    if after["gstin"] and after["pan"] and after["gstin"][2:12] != after["pan"]:
        fail(400, "validation_error", "PAN must match characters 3–12 of the GSTIN.")
    if "tdsRatePercent" in body:
        after["tdsRatePercent"] = _rate(body["tdsRatePercent"], "tdsRatePercent")
    if "gstRatePercent" in body:
        after["gstRatePercent"] = _rate(body["gstRatePercent"], "gstRatePercent")
    if "academicYear" in body:
        fy_bounds(body["academicYear"])
        after["academicYear"] = str(body["academicYear"]).replace("–", "-").strip()
    for field, allowed in _CHOICES.items():
        if field in body:
            if body[field] not in allowed:
                fail(400, "validation_error", f"{field} must be one of: {', '.join(allowed)}.")
            after[field] = body[field]
    if "booksClosure" in body:
        toggles = body["booksClosure"]
        if not isinstance(toggles, dict) or any(k not in _BOOKS_CLOSURE_IDS for k in toggles):
            fail(400, "validation_error", f"booksClosure keys must be: {', '.join(_BOOKS_CLOSURE_IDS)}.")
        after["booksClosure"] = {**before["booksClosure"], **{k: bool(v) for k, v in toggles.items()}}

    changed = sorted(k for k in DEFAULTS if after.get(k) != before.get(k))
    if not changed:
        return {"success": True, "skipped": True, "reason": "no_change", "settings": before}

    record = {"id": _SETTINGS_ID, **after, "updatedAt": _now(), "updatedBy": actor.email}
    others = [row for row in (data.get("financeSettings") or []) if isinstance(row, dict) and row.get("id") != _SETTINGS_ID]
    data["financeSettings"] = [record, *others]
    fin.persist_state(db, actor, {"data": data}, commit=False, audit_action="FINANCE_SETTINGS_STATE")
    write_audit(
        db,
        action="finance.settings.update",
        entity_type="finance_settings",
        entity_id=_SETTINGS_ID,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"changed={','.join(changed)}"[:500],
    )
    db.commit()
    return {"success": True, "skipped": False, "changed": changed, "settings": current_settings(data)}
