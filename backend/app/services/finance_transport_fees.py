"""Transport fee registry on the campus finance snapshot (mirrors activity fees)."""

from __future__ import annotations

import hashlib
from uuid import uuid4

from sqlalchemy.orm import Session

from app.deps import role_code_for
from app.models import User
from app.services import finance as fin
from app.services.audit import write_audit
from app.services.errors import fail
from app.services.finance_actions import (
    _TRANSPORT_FEE_ROLES,
    _assignment_payment_status,
    _now,
    collect_payment,
    post_transport_enrollment_fee,
)

_BILLING_CYCLES = {"Yearly", "Half Yearly", "Quarterly", "Monthly"}


def _rows(data: dict) -> list[dict]:
    rows = data.get("transportFees") or []
    return [row for row in rows if isinstance(row, dict)]


def _split(data: dict) -> tuple[list[dict], list[dict]]:
    fees: list[dict] = []
    assignments: list[dict] = []
    for row in _rows(data):
        kind = str(row.get("recordType") or row.get("kind") or "").lower()
        if kind == "assignment" or (row.get("feeId") and kind != "fee"):
            assignments.append(row)
        else:
            fees.append({**row, "recordType": "fee"})
    return fees, assignments


def _write(data: dict, fees: list[dict], assignments: list[dict]) -> None:
    data["transportFees"] = [
        *[{**row, "recordType": "fee"} for row in fees],
        *[{**row, "recordType": "assignment"} for row in assignments],
    ]


def _money(value) -> float:
    if isinstance(value, (int, float)):
        return float(value or 0)
    digits = "".join(ch for ch in str(value or "") if ch.isdigit() or ch == ".")
    try:
        return float(digits) if digits else 0.0
    except ValueError:
        return 0.0


def _stable_assignment_id(fee_id: str, student_id: str) -> str:
    """Keep ids short enough for audit_logs.entity_id (varchar 64) and INST-TRN- prefix."""
    naive = f"TASN-{fee_id}-{student_id}"
    if len(naive) <= 48:
        return naive
    digest = hashlib.sha1(f"{fee_id}|{student_id}".encode("utf-8")).hexdigest()[:20].upper()
    return f"TASN-{digest}"


def list_transport_fees(db: Session, actor: User) -> dict:
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")
    state = fin.get_state(db, actor)
    data = state["data"]
    fees, assignments = _split(data)
    installments = {
        str(row.get("id")): row
        for row in (data.get("installments") or [])
        if isinstance(row, dict) and row.get("id")
    }
    enriched = []
    for row in assignments:
        inst = installments.get(str(row.get("installmentId") or ""))
        payment_status = _assignment_payment_status(inst, str(row.get("paymentStatus") or "Unpaid"))
        receipt_no = row.get("receiptNo") or (inst or {}).get("receiptNo") or ""
        enriched.append(
            {
                **row,
                "recordType": "assignment",
                "paymentStatus": payment_status,
                "receiptNo": receipt_no,
                "installmentBalance": (inst or {}).get("balanceAmount"),
                "installmentPaid": (inst or {}).get("paidAmount"),
            }
        )
    return {
        "success": True,
        "fees": fees,
        "assignments": enriched,
        "feeCount": len(fees),
        "assignmentCount": len(enriched),
    }


def upsert_transport_fee(db: Session, actor: User, payload: dict) -> dict:
    code = role_code_for(db, actor)
    if code not in _TRANSPORT_FEE_ROLES:
        fail(403, "forbidden", "Not allowed to manage transport fees.")
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")

    route_id = str((payload or {}).get("routeId") or "").strip()
    route_name = str((payload or {}).get("routeName") or route_id or "Transport route").strip()
    if not route_id and not route_name:
        fail(400, "validation_error", "routeId or routeName is required.")
    if not route_id:
        route_id = f"ROUTE-{uuid4().hex[:8].upper()}"

    billing = str((payload or {}).get("billingCycle") or "Yearly").strip() or "Yearly"
    if billing not in _BILLING_CYCLES:
        fail(400, "validation_error", "billingCycle must be Yearly, Half Yearly, Quarterly or Monthly.")

    amount = _money((payload or {}).get("amount") or (payload or {}).get("yearlyAmount") or 0)
    if amount <= 0:
        fail(400, "validation_error", "Transport fee amount must be greater than zero.")

    state = fin.get_state(db, actor)
    data = dict(state["data"])
    fees, assignments = _split(data)
    fee_id = str((payload or {}).get("id") or f"TFE-{route_id}")
    existing = next((row for row in fees if str(row.get("id")) == fee_id), None)
    fee = {
        **(existing or {}),
        "id": fee_id,
        "recordType": "fee",
        "routeId": route_id,
        "routeName": route_name,
        "billingCycle": billing,
        "amount": amount,
        "academicYear": str((payload or {}).get("academicYear") or "2026-27"),
        "status": str((payload or {}).get("status") or "Active"),
        "remarks": str((payload or {}).get("remarks") or ""),
        "campusId": str(actor.campus_id),
        "updatedAt": _now(),
        "updatedBy": actor.email,
    }
    if existing is None:
        fee["createdAt"] = _now()
        fee["createdBy"] = actor.email
        fees.insert(0, fee)
    else:
        fees = [fee if str(row.get("id")) == fee_id else row for row in fees]

    _write(data, fees, assignments)
    saved = fin.persist_state(
        db,
        actor,
        {"data": data},
        commit=False,
        audit_action="FINANCE_TRANSPORT_FEE_UPSERT_STATE",
    )
    write_audit(
        db,
        action="finance.transport_fee.upsert",
        entity_type="transport_fee",
        entity_id=fee_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"route={route_id};amount={amount};billing={billing}",
    )
    db.commit()
    return {"success": True, "fee": fee, "state": saved}


def assign_transport_fee(db: Session, actor: User, payload: dict) -> dict:
    code = role_code_for(db, actor)
    if code not in _TRANSPORT_FEE_ROLES:
        fail(403, "forbidden", "Not allowed to assign transport fees.")
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")

    student_id = str((payload or {}).get("studentId") or "").strip()
    student_name = str((payload or {}).get("studentName") or (payload or {}).get("participantName") or "").strip()
    route_id = str((payload or {}).get("routeId") or "").strip()
    route_name = str((payload or {}).get("routeName") or "").strip()
    fee_id = str((payload or {}).get("feeId") or "").strip()
    stop_name = str((payload or {}).get("stopName") or "").strip()
    ops_assignment_id = str((payload or {}).get("opsAssignmentId") or (payload or {}).get("id") or "").strip()

    if not student_id:
        fail(400, "validation_error", "studentId is required.")

    state = fin.get_state(db, actor)
    data = dict(state["data"])
    fees, assignments = _split(data)

    fee = None
    if fee_id:
        fee = next((row for row in fees if str(row.get("id")) == fee_id), None)
    if fee is None and route_id:
        fee = next((row for row in fees if str(row.get("routeId")) == route_id), None)
    if fee is None:
        # Auto-provision a route fee when TM assigns without a prior Finance definition.
        amount = _money((payload or {}).get("amount") or (payload or {}).get("yearlyFees") or 0)
        if amount <= 0:
            fail(400, "validation_error", "No transport fee definition found; provide amount or create a fee first.")
        created = upsert_transport_fee(
            db,
            actor,
            {
                "routeId": route_id or f"ROUTE-{student_id}",
                "routeName": route_name or route_id or "Transport route",
                "billingCycle": (payload or {}).get("billingCycle") or "Yearly",
                "amount": amount,
                "academicYear": (payload or {}).get("academicYear") or "2026-27",
            },
        )
        fee = created["fee"]
        state = fin.get_state(db, actor)
        data = dict(state["data"])
        fees, assignments = _split(data)

    fee_id = str(fee.get("id"))
    assignment_id = str((payload or {}).get("assignmentId") or "").strip() or _stable_assignment_id(
        fee_id, student_id
    )
    existing = next((row for row in assignments if str(row.get("id")) == assignment_id), None)
    if existing is not None:
        listed = list_transport_fees(db, actor)
        match = next((row for row in listed["assignments"] if str(row.get("id")) == assignment_id), existing)
        return {
            "success": True,
            "skipped": True,
            "reason": "already_assigned",
            "assignment": match,
        }

    if not student_name:
        student_row = next(
            (row for row in (data.get("students") or []) if str(row.get("id")) == student_id),
            None,
        )
        student_name = str((student_row or {}).get("name") or student_id)

    amount = float(fee.get("amount") or 0)
    installment_id = f"INST-TRN-{assignment_id}"
    posted = post_transport_enrollment_fee(
        db,
        actor,
        {
            "transportAssignmentId": assignment_id,
            "student": {
                "id": student_id,
                "name": student_name,
                "academicYear": fee.get("academicYear") or "2026-27",
                "className": str((payload or {}).get("className") or "Transport"),
            },
            "feeStructure": {
                "id": f"FS-TRANSPORT-{fee_id}",
                "name": f"Transport — {fee.get('routeName') or route_name or fee_id}",
                "academicYear": fee.get("academicYear") or "2026-27",
                "className": "Transport",
                "transportFeeId": fee_id,
                "transportAssignmentId": assignment_id,
                "routeId": fee.get("routeId") or route_id,
            },
            "installments": [
                {
                    "id": installment_id,
                    "feeAmount": amount,
                    "netAmount": amount,
                    "paidAmount": 0,
                    "balanceAmount": amount,
                    "status": "UNPAID",
                    "installmentLabel": f"Transport ({fee.get('billingCycle') or 'Yearly'})",
                    "dueDate": _now()[:10],
                    "academicYear": fee.get("academicYear") or "2026-27",
                    "routeId": fee.get("routeId") or route_id,
                    "routeName": fee.get("routeName") or route_name,
                    "stopName": stop_name,
                }
            ],
        },
    )

    assignment = {
        "id": assignment_id,
        "recordType": "assignment",
        "feeId": fee_id,
        "routeId": fee.get("routeId") or route_id,
        "routeName": fee.get("routeName") or route_name,
        "stopName": stop_name,
        "studentId": student_id,
        "studentName": student_name,
        "billingCycle": fee.get("billingCycle") or "Yearly",
        "amount": amount,
        "payable": amount,
        "paymentStatus": "Unpaid",
        "receiptNo": "",
        "installmentId": installment_id,
        "feeStructureId": posted.get("feeStructureId"),
        "opsAssignmentId": ops_assignment_id or None,
        "transportAssignmentId": assignment_id,
        "campusId": str(actor.campus_id),
        "createdAt": _now(),
        "createdBy": actor.email,
    }

    state = fin.get_state(db, actor)
    data = dict(state["data"])
    fees, assignments = _split(data)
    if any(str(row.get("id")) == assignment_id for row in assignments):
        return {"success": True, "skipped": True, "reason": "already_assigned", "assignment": assignment}
    assignments.insert(0, assignment)
    _write(data, fees, assignments)
    saved = fin.persist_state(
        db,
        actor,
        {"data": data},
        commit=False,
        audit_action="FINANCE_TRANSPORT_FEE_ASSIGN_STATE",
    )
    write_audit(
        db,
        action="finance.transport_fee.assign",
        entity_type="transport_assignment",
        entity_id=assignment_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"fee={fee_id};student={student_id};amount={amount}",
    )
    db.commit()
    return {
        "success": True,
        "skipped": False,
        "assignment": assignment,
        "installmentId": installment_id,
        "state": saved,
    }


def collect_transport_fee(db: Session, actor: User, payload: dict) -> dict:
    assignment_id = str((payload or {}).get("assignmentId") or (payload or {}).get("id") or "").strip()
    if not assignment_id:
        fail(400, "validation_error", "assignmentId is required.")

    state = fin.get_state(db, actor)
    data = state["data"]
    fees, assignments = _split(data)
    assignment = next((row for row in assignments if str(row.get("id")) == assignment_id), None)
    if assignment is None:
        fail(404, "not_found", "Transport assignment was not found on this campus.")

    installment_id = str(assignment.get("installmentId") or f"INST-TRN-{assignment_id}")
    installment = next(
        (row for row in (data.get("installments") or []) if str(row.get("id")) == installment_id),
        None,
    )
    if installment is None:
        fail(404, "not_found", "Linked transport installment was not found.")

    if _assignment_payment_status(installment) == "Paid":
        return {
            "success": True,
            "skipped": True,
            "reason": "already_paid",
            "assignment": {**assignment, "paymentStatus": "Paid", "receiptNo": assignment.get("receiptNo")},
        }

    student_id = str(assignment.get("studentId") or installment.get("studentId") or "")
    amount = float(installment.get("balanceAmount") or assignment.get("payable") or assignment.get("amount") or 0)
    collected = collect_payment(
        db,
        actor,
        {
            "studentId": student_id,
            "paymentMode": str((payload or {}).get("paymentMode") or "CASH").upper(),
            "allocations": [{"installmentId": installment_id, "amount": amount}],
        },
    )

    state = fin.get_state(db, actor)
    data = dict(state["data"])
    fees, assignments = _split(data)
    row = next((item for item in assignments if str(item.get("id")) == assignment_id), None)
    if row is None:
        fail(500, "state_error", "Assignment missing after collection.")
    receipt = collected.get("receipt") or {}
    row["paymentStatus"] = "Paid"
    row["receiptNo"] = receipt.get("receiptNo") or row.get("receiptNo") or ""
    row["paidAt"] = _now()
    row["paidBy"] = actor.email
    _write(data, fees, assignments)
    saved = fin.persist_state(
        db,
        actor,
        {"data": data},
        commit=False,
        audit_action="FINANCE_TRANSPORT_FEE_COLLECT_STATE",
    )
    write_audit(
        db,
        action="finance.transport_fee.collect",
        entity_type="transport_assignment",
        entity_id=assignment_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"receipt={row.get('receiptNo')};amount={amount}",
    )
    db.commit()
    return {
        "success": True,
        "skipped": False,
        "assignment": row,
        "receipt": receipt,
        "transaction": collected.get("transaction"),
        "state": saved,
    }


def sync_ops_transport_assignments(db: Session, actor: User, assignments: list[dict]) -> dict:
    """After TM ops save: ensure Active student↔route rows have finance installments."""
    posted = 0
    skipped = 0
    errors: list[dict] = []
    for row in assignments or []:
        if not isinstance(row, dict):
            continue
        if str(row.get("status") or "Active").lower() not in {"active", "assigned", ""}:
            continue
        student_id = str(row.get("studentId") or "").strip()
        route_id = str(row.get("routeId") or "").strip()
        if not student_id or not route_id:
            continue
        try:
            amount = row.get("amount") or row.get("yearlyFees") or row.get("feeAmount")
            # If Finance already defined a route fee, amount can be omitted.
            payload = {
                "studentId": student_id,
                "studentName": row.get("studentName"),
                "routeId": route_id,
                "routeName": row.get("routeName"),
                "stopName": row.get("stopName"),
                "opsAssignmentId": row.get("id"),
                "billingCycle": row.get("billingCycle") or row.get("feesStructure") or "Yearly",
                "className": row.get("classSection") or row.get("className") or "Transport",
            }
            if amount not in (None, "", 0, "0"):
                payload["amount"] = amount
            elif not any(
                str(f.get("routeId")) == route_id
                for f in (fin.get_state(db, actor)["data"].get("transportFees") or [])
                if isinstance(f, dict) and str(f.get("recordType") or "fee") == "fee"
            ):
                payload["amount"] = 12000
            result = assign_transport_fee(db, actor, payload)
            if result.get("skipped"):
                skipped += 1
            else:
                posted += 1
        except Exception as exc:  # noqa: BLE001 — keep ops save successful; report finance sync gaps
            errors.append({"studentId": student_id, "routeId": route_id, "error": str(exc)[:300]})
    return {"posted": posted, "skipped": skipped, "errors": errors}
