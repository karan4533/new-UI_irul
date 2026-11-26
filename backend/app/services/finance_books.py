"""Book fee breakup (vendor lines that make up a student's assigned book fee) — live on campus finance snapshot."""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.models import User
from app.services import finance as fin
from app.services.audit import write_audit
from app.services.errors import fail
from app.services.finance_accounting import _WRITE_ROLES, _money_label, _require_campus, _require_role
from app.services.finance_actions import _now
from app.services.finance_settings import fy_bounds


def _line_view(row: dict) -> dict:
    quantity = int(row.get("quantity") or 0)
    unit = float(row.get("unitCost") or 0)
    return {**row, "quantity": quantity, "unitCost": unit, "total": round(quantity * unit, 2)}


def _summaries(lines: list[dict]) -> list[dict]:
    groups: dict[tuple[str, str], dict] = {}
    for line in lines:
        key = (str(line.get("studentId") or ""), str(line.get("academicYear") or ""))
        slot = groups.setdefault(
            key,
            {
                "studentId": key[0],
                "student": line.get("student") or "",
                "academicYear": key[1],
                "assignedFee": None,
                "lineTotal": 0.0,
                "lineCount": 0,
                "vendors": [],
            },
        )
        slot["lineTotal"] = round(slot["lineTotal"] + line["total"], 2)
        slot["lineCount"] += 1
        if line.get("assignedFee") is not None:
            slot["assignedFee"] = float(line["assignedFee"])
        vendor = str(line.get("vendor") or "")
        if vendor and vendor not in slot["vendors"]:
            slot["vendors"].append(vendor)
    out = []
    for slot in groups.values():
        assigned = slot["assignedFee"]
        if assigned is None:
            status, difference = "No assigned fee", None
        else:
            difference = round(assigned - slot["lineTotal"], 2)
            status = "Matched" if abs(difference) < 0.01 else ("Under-allocated" if difference > 0 else "Over-allocated")
        out.append({**slot, "difference": difference, "status": status})
    return sorted(out, key=lambda r: (r["student"].lower(), r["academicYear"]))


def list_book_fees(db: Session, actor: User) -> dict:
    _require_campus(actor)
    data = fin.get_state(db, actor)["data"]
    lines = [_line_view(row) for row in (data.get("bookFeeBreakup") or []) if isinstance(row, dict)]
    summaries = _summaries(lines)
    students = [
        {"id": str(row.get("id")), "name": row.get("name") or "", "className": row.get("className") or ""}
        for row in (data.get("students") or [])
        if isinstance(row, dict) and row.get("id")
    ]
    return {
        "success": True,
        "lines": lines,
        "summaries": summaries,
        "students": students,
        "totals": {
            "lineTotal": round(sum(r["total"] for r in lines), 2),
            "lineTotalLabel": _money_label(sum(r["total"] for r in lines)),
            "lineCount": len(lines),
            "studentCount": len(summaries),
            "mismatchCount": sum(1 for s in summaries if s["status"] in {"Under-allocated", "Over-allocated"}),
        },
    }


def _positive_int(value, field: str) -> int:
    try:
        number = float(value)
    except (TypeError, ValueError):
        fail(400, "validation_error", f"{field} must be a whole number.")
    if number <= 0 or number != int(number):
        fail(400, "validation_error", f"{field} must be a positive whole number.")
    return int(number)


def _money(value, field: str, *, allow_none: bool = False):
    if value is None or value == "":
        if allow_none:
            return None
        fail(400, "validation_error", f"{field} is required.")
    try:
        amount = round(float(value), 2)
    except (TypeError, ValueError):
        fail(400, "validation_error", f"{field} must be a number.")
    if amount < 0:
        fail(400, "validation_error", f"{field} cannot be negative.")
    return amount


def upsert_book_fee_line(db: Session, actor: User, payload: dict) -> dict:
    _require_role(db, actor, _WRITE_ROLES, "manage book fees")
    _require_campus(actor)
    body = payload or {}
    student_id = str(body.get("studentId") or "").strip()
    vendor = str(body.get("vendor") or "").strip()
    book = str(body.get("book") or "").strip()
    academic_year = str(body.get("academicYear") or "").replace("–", "-").strip()
    if not student_id:
        fail(400, "validation_error", "studentId is required.")
    if not vendor:
        fail(400, "validation_error", "vendor is required.")
    if not book:
        fail(400, "validation_error", "book is required.")
    fy_bounds(academic_year)
    quantity = _positive_int(body.get("quantity"), "quantity")
    unit_cost = _money(body.get("unitCost"), "unitCost")
    assigned_fee = _money(body.get("assignedFee"), "assignedFee", allow_none=True)

    data = dict(fin.get_state(db, actor)["data"])
    student = next(
        (row for row in (data.get("students") or []) if isinstance(row, dict) and str(row.get("id")) == student_id),
        None,
    )
    if student is None:
        fail(404, "not_found", "Student not found in campus finance records.")
    lines = [dict(row) for row in (data.get("bookFeeBreakup") or []) if isinstance(row, dict)]

    line_id = str(body.get("id") or "").strip()
    existing = next((row for row in lines if row.get("id") == line_id), None) if line_id else None
    if line_id and existing is None:
        fail(404, "not_found", "Book fee line not found.")
    if existing is None:
        duplicate = next(
            (
                row
                for row in lines
                if str(row.get("studentId")) == student_id
                and str(row.get("academicYear")) == academic_year
                and row.get("vendor", "").lower() == vendor.lower()
                and row.get("book", "").lower() == book.lower()
            ),
            None,
        )
        if duplicate is not None:
            return {"success": True, "skipped": True, "reason": "already_exists", "line": _line_view(duplicate)}
        used = [int(m.group(1)) for row in lines if (m := re.match(r"^BF-(\d+)$", str(row.get("id") or "")))]
        line_id = f"BF-{(max(used) + 1 if used else 1):04d}"

    record = {
        "id": line_id,
        "studentId": student_id,
        "student": student.get("name") or "",
        "className": student.get("className") or "",
        "academicYear": academic_year,
        "vendor": vendor,
        "book": book,
        "quantity": quantity,
        "unitCost": unit_cost,
        "assignedFee": assigned_fee if assigned_fee is not None else (existing or {}).get("assignedFee"),
        "updatedAt": _now(),
        "updatedBy": actor.email,
        "createdAt": (existing or {}).get("createdAt") or _now(),
        "createdBy": (existing or {}).get("createdBy") or actor.email,
    }
    if existing is None:
        lines.insert(0, record)
    else:
        lines[lines.index(existing)] = record
    if assigned_fee is not None:
        for row in lines:
            if str(row.get("studentId")) == student_id and str(row.get("academicYear")) == academic_year:
                row["assignedFee"] = assigned_fee
    data["bookFeeBreakup"] = lines
    fin.persist_state(db, actor, {"data": data}, commit=False, audit_action="FINANCE_BOOK_FEE_STATE")
    write_audit(
        db,
        action="finance.book_fee.upsert",
        entity_type="finance_book_fee",
        entity_id=line_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"student={student_id};year={academic_year};qty={quantity};unit={unit_cost}",
    )
    db.commit()
    return {"success": True, "skipped": False, "created": existing is None, "line": _line_view(record)}


def delete_book_fee_line(db: Session, actor: User, payload: dict) -> dict:
    _require_role(db, actor, _WRITE_ROLES, "manage book fees")
    _require_campus(actor)
    line_id = str((payload or {}).get("id") or "").strip()
    if not line_id:
        fail(400, "validation_error", "id is required.")
    data = dict(fin.get_state(db, actor)["data"])
    lines = [dict(row) for row in (data.get("bookFeeBreakup") or []) if isinstance(row, dict)]
    existing = next((row for row in lines if row.get("id") == line_id), None)
    if existing is None:
        return {"success": True, "skipped": True, "reason": "not_found"}
    data["bookFeeBreakup"] = [row for row in lines if row.get("id") != line_id]
    fin.persist_state(db, actor, {"data": data}, commit=False, audit_action="FINANCE_BOOK_FEE_STATE")
    write_audit(
        db,
        action="finance.book_fee.delete",
        entity_type="finance_book_fee",
        entity_id=line_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"student={existing.get('studentId')};book={existing.get('book')}",
    )
    db.commit()
    return {"success": True, "skipped": False, "deleted": line_id}
