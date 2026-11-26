"""Academic fee structures, concessions, and unpaid installments (Wave A PARTIAL → LIVE)."""

from __future__ import annotations

from datetime import date
from uuid import uuid4

from sqlalchemy.orm import Session

from app.deps import role_code_for
from app.models import User
from app.services import finance as fin
from app.services.audit import write_audit
from app.services.errors import fail
from app.services.finance_actions import (
    _ACTIVITY_FEE_ROLES,
    _live_payable,
    _now,
)

# Reuse finance writer roles for academic fee config / concessions / defaulters.
_ACADEMIC_FEE_ROLES = set(_ACTIVITY_FEE_ROLES) | {
    "accounthead",
    "finance",
    "financeassistant",
    "admin",
    "superadmin",
}


def _money(value) -> float:
    if isinstance(value, (int, float)):
        return float(value or 0)
    digits = "".join(ch for ch in str(value or "") if ch.isdigit() or ch == ".")
    try:
        return float(digits) if digits else 0.0
    except ValueError:
        return 0.0


def list_fee_structures(db: Session, actor: User) -> dict:
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")
    state = fin.get_state(db, actor)
    data = state["data"]
    structures = [row for row in (data.get("feeStructures") or []) if isinstance(row, dict)]
    categories = [row for row in (data.get("feeCategories") or []) if isinstance(row, dict)]
    fine_rules = [row for row in (data.get("fineRules") or []) if isinstance(row, dict)]
    return {
        "success": True,
        "structures": structures,
        "categories": categories,
        "fineRules": fine_rules,
        "structureCount": len(structures),
        "categoryCount": len(categories),
    }


def upsert_fee_structure(db: Session, actor: User, payload: dict) -> dict:
    code = role_code_for(db, actor)
    if code not in _ACADEMIC_FEE_ROLES:
        fail(403, "forbidden", "Not allowed to manage fee structures.")
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")

    body = payload or {}
    academic_year = str(body.get("academicYear") or "").strip()
    class_name = str(body.get("className") or body.get("grade") or "").strip()
    fee_head = str(body.get("feeHead") or body.get("name") or "").strip()
    amount = _money(body.get("amount") or body.get("totalAmount") or 0)
    if not academic_year:
        fail(400, "validation_error", "academicYear is required.")
    if not class_name:
        fail(400, "validation_error", "className is required.")
    if not fee_head:
        fail(400, "validation_error", "feeHead is required.")
    if amount < 0:
        fail(400, "validation_error", "amount must be zero or greater.")

    state = fin.get_state(db, actor)
    data = dict(state["data"])
    structures = [row for row in (data.get("feeStructures") or []) if isinstance(row, dict)]
    fee_id = str(body.get("id") or "").strip() or f"FS-{uuid4().hex[:10].upper()}"
    existing = next((row for row in structures if str(row.get("id")) == fee_id), None)

    structure = {
        **(existing or {}),
        "id": fee_id,
        "academicYear": academic_year,
        "className": class_name,
        "classId": body.get("classId") or (existing or {}).get("classId") or class_name,
        "feeCategoryId": str(body.get("feeCategoryId") or (existing or {}).get("feeCategoryId") or "CAT-TUITION"),
        "feeHead": fee_head,
        "frequency": str(body.get("frequency") or (existing or {}).get("frequency") or "YEARLY").upper(),
        "amount": amount,
        "totalAmount": amount,
        "dueDayOfMonth": int(body.get("dueDayOfMonth") or (existing or {}).get("dueDayOfMonth") or 10),
        "fineRuleId": body.get("fineRuleId") if body.get("fineRuleId") is not None else (existing or {}).get("fineRuleId"),
        "concessionApplicable": bool(
            body.get("concessionApplicable")
            if "concessionApplicable" in body
            else (existing or {}).get("concessionApplicable", True)
        ),
        "mandatory": bool(body.get("mandatory") if "mandatory" in body else (existing or {}).get("mandatory", True)),
        "status": str(body.get("status") or (existing or {}).get("status") or "ACTIVE").upper(),
        "campusId": str(actor.campus_id),
        "updatedAt": _now(),
        "updatedBy": actor.email,
    }
    if existing is None:
        structure["createdAt"] = _now()
        structure["createdBy"] = actor.email
        structures.insert(0, structure)
    else:
        structures = [structure if str(row.get("id")) == fee_id else row for row in structures]

    # Optional inline category create
    category_name = str(body.get("newCategory") or body.get("categoryName") or "").strip()
    categories = [row for row in (data.get("feeCategories") or []) if isinstance(row, dict)]
    if category_name:
        cat_id = str(body.get("feeCategoryId") or f"CAT-{uuid4().hex[:8].upper()}")
        if not any(str(row.get("id")) == cat_id for row in categories):
            categories.insert(
                0,
                {
                    "id": cat_id,
                    "name": category_name,
                    "status": "ACTIVE",
                    "createdAt": _now(),
                    "createdBy": actor.email,
                },
            )
            structure["feeCategoryId"] = cat_id
        data["feeCategories"] = categories

    data["feeStructures"] = structures
    saved = fin.persist_state(
        db,
        actor,
        {"data": data},
        commit=False,
        audit_action="FINANCE_FEE_STRUCTURE_UPSERT_STATE",
    )
    write_audit(
        db,
        action="finance.fee_structure.upsert",
        entity_type="fee_structure",
        entity_id=fee_id[:64],
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"class={class_name};head={fee_head};amount={amount}",
    )
    db.commit()
    return {"success": True, "structure": structure, "state": saved}


def list_concessions(db: Session, actor: User) -> dict:
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")
    state = fin.get_state(db, actor)
    data = state["data"]
    rows = [row for row in (data.get("concessions") or []) if isinstance(row, dict)]
    students = {
        str(row.get("id")): row
        for row in (data.get("students") or [])
        if isinstance(row, dict) and row.get("id")
    }
    categories = {
        str(row.get("id")): row
        for row in (data.get("feeCategories") or [])
        if isinstance(row, dict) and row.get("id")
    }
    enriched = []
    for row in rows:
        student = students.get(str(row.get("studentId") or ""))
        category = categories.get(str(row.get("feeCategoryId") or ""))
        enriched.append(
            {
                **row,
                "studentName": (student or {}).get("name") or row.get("studentName") or "",
                "admissionNo": (student or {}).get("admissionNo") or row.get("admissionNumber") or "",
                "className": (student or {}).get("className") or row.get("className") or "",
                "feeCategoryName": (category or {}).get("name") or row.get("feeCategoryId") or "",
            }
        )
    return {"success": True, "concessions": enriched, "concessionCount": len(enriched)}


def create_concession(db: Session, actor: User, payload: dict) -> dict:
    code = role_code_for(db, actor)
    if code not in _ACADEMIC_FEE_ROLES:
        fail(403, "forbidden", "Not allowed to create concessions.")
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")

    body = payload or {}
    student_id = str(body.get("studentId") or "").strip()
    if not student_id:
        fail(400, "validation_error", "studentId is required.")
    amount = _money(body.get("amount") or 0)
    amount_type = str(body.get("amountType") or "FIXED").upper()
    if amount_type not in {"FIXED", "PERCENT"}:
        fail(400, "validation_error", "amountType must be FIXED or PERCENT.")
    if amount <= 0:
        fail(400, "validation_error", "Concession amount must be greater than zero.")
    if amount_type == "PERCENT" and amount > 100:
        fail(400, "validation_error", "PERCENT concession cannot exceed 100.")

    state = fin.get_state(db, actor)
    data = dict(state["data"])
    students = [row for row in (data.get("students") or []) if isinstance(row, dict)]
    student = next((row for row in students if str(row.get("id")) == student_id), None)
    if student is None:
        fail(404, "not_found", "Student was not found on this campus finance snapshot.")

    concession_id = str(body.get("id") or "").strip() or f"CON-{uuid4().hex[:10].upper()}"
    concessions = [row for row in (data.get("concessions") or []) if isinstance(row, dict)]
    if any(str(row.get("id")) == concession_id for row in concessions):
        existing = next(row for row in concessions if str(row.get("id")) == concession_id)
        return {"success": True, "skipped": True, "reason": "already_exists", "concession": existing}

    fee_category_id = str(body.get("feeCategoryId") or "CAT-TUITION")
    concession = {
        "id": concession_id,
        "studentId": student_id,
        "studentName": student.get("name"),
        "type": str(body.get("type") or body.get("concessionType") or "Waiver"),
        "feeCategoryId": fee_category_id,
        "amount": amount,
        "amountType": amount_type,
        "status": str(body.get("status") or "Approved"),
        "academicYear": str(body.get("academicYear") or student.get("academicYear") or "2026-27"),
        "remarks": str(body.get("remarks") or ""),
        "source": "finance",
        "createdAt": _now(),
        "createdBy": actor.email,
        "campusId": str(actor.campus_id),
    }
    concessions.insert(0, concession)

    # Apply onto matching open installments (same shape as HR apply).
    installments = [row for row in (data.get("installments") or []) if isinstance(row, dict)]
    touched = 0
    for row in installments:
        if str(row.get("studentId")) != student_id:
            continue
        status = str(row.get("status") or "").upper()
        if status in {"PAID", "WAIVED", "CANCELLED"}:
            continue
        cat = str(row.get("feeCategoryId") or "")
        if fee_category_id and cat and cat != fee_category_id and fee_category_id != "CAT-ALL":
            # Still allow apply when installment has no category.
            if cat:
                continue
        fee = float(row.get("feeAmount") or 0)
        if amount_type == "PERCENT":
            concession_amt = round(fee * amount / 100, 2)
        else:
            concession_amt = min(amount, fee)
        row["concessionAmount"] = concession_amt
        row["netAmount"] = max(0.0, fee - concession_amt + float(row.get("fineAmount") or 0))
        row["balanceAmount"] = max(0.0, float(row["netAmount"]) - float(row.get("paidAmount") or 0))
        touched += 1

    data["concessions"] = concessions
    data["installments"] = installments
    saved = fin.persist_state(
        db,
        actor,
        {"data": data},
        commit=False,
        audit_action="FINANCE_CONCESSION_CREATE_STATE",
    )
    write_audit(
        db,
        action="finance.concession.create",
        entity_type="concession",
        entity_id=concession_id[:64],
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"student={student_id};amount={amount};type={amount_type};installments={touched}",
    )
    db.commit()
    return {
        "success": True,
        "skipped": False,
        "concession": concession,
        "installmentsUpdated": touched,
        "state": saved,
    }


def list_unpaid_installments(db: Session, actor: User) -> dict:
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")
    state = fin.get_state(db, actor)
    data = state["data"]
    fine_rules = [row for row in (data.get("fineRules") or []) if isinstance(row, dict)]
    students = {
        str(row.get("id")): row
        for row in (data.get("students") or [])
        if isinstance(row, dict) and row.get("id")
    }
    as_of = date.today()
    unpaid = []
    for row in data.get("installments") or []:
        if not isinstance(row, dict):
            continue
        status = str(row.get("status") or "").upper()
        if status in {"PAID", "WAIVED", "CANCELLED"}:
            continue
        fine, net, balance = _live_payable(row, fine_rules, as_of)
        if balance <= 0 and status not in {"UNPAID", "PARTIALLY_PAID", "OVERDUE"}:
            continue
        if balance <= 0:
            continue
        student = students.get(str(row.get("studentId") or ""))
        due = str(row.get("dueDate") or "")
        overdue = False
        try:
            if due:
                overdue = date.fromisoformat(due[:10]) < as_of
        except ValueError:
            overdue = status == "OVERDUE"
        display_status = "OVERDUE" if overdue or status == "OVERDUE" else status or "UNPAID"
        unpaid.append(
            {
                **row,
                "fineAmount": fine,
                "netAmount": net,
                "balanceAmount": balance,
                "paymentStatus": display_status,
                "studentName": (student or {}).get("name") or row.get("studentName") or "",
                "admissionNo": (student or {}).get("admissionNo") or "",
                "className": (student or {}).get("className") or row.get("className") or "",
                "section": (student or {}).get("section") or "",
            }
        )

    # Aggregate by student for defaulters register
    by_student: dict[str, dict] = {}
    for row in unpaid:
        sid = str(row.get("studentId") or "")
        bucket = by_student.setdefault(
            sid,
            {
                "studentId": sid,
                "studentName": row.get("studentName") or "",
                "admissionNo": row.get("admissionNo") or "",
                "className": row.get("className") or "",
                "section": row.get("section") or "",
                "outstanding": 0.0,
                "installmentCount": 0,
                "worstStatus": "UNPAID",
                "feeHeads": [],
                "oldestDueDate": row.get("dueDate") or "",
                "installments": [],
            },
        )
        bucket["outstanding"] += float(row.get("balanceAmount") or 0)
        bucket["installmentCount"] += 1
        bucket["installments"].append(row)
        head = str(row.get("feeHead") or row.get("installmentLabel") or "")
        if head and head not in bucket["feeHeads"]:
            bucket["feeHeads"].append(head)
        if str(row.get("paymentStatus")) == "OVERDUE":
            bucket["worstStatus"] = "OVERDUE"
        elif bucket["worstStatus"] != "OVERDUE" and str(row.get("paymentStatus")) == "PARTIALLY_PAID":
            bucket["worstStatus"] = "PARTIALLY_PAID"
        due = str(row.get("dueDate") or "")
        if due and (not bucket["oldestDueDate"] or due < bucket["oldestDueDate"]):
            bucket["oldestDueDate"] = due

    defaulters = sorted(by_student.values(), key=lambda item: -float(item.get("outstanding") or 0))
    total_outstanding = sum(float(item.get("outstanding") or 0) for item in defaulters)
    critical = sum(1 for item in defaulters if item.get("worstStatus") == "OVERDUE")
    return {
        "success": True,
        "installments": unpaid,
        "defaulters": defaulters,
        "installmentCount": len(unpaid),
        "defaulterCount": len(defaulters),
        "totalOutstanding": round(total_outstanding, 2),
        "criticalCount": critical,
    }
