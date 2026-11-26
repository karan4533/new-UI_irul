"""Purchase / material requisition persistence with Finance approval-limit enforcement."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.deps import permission_codes_for, role_code_for
from app.models import FinanceRecord, User
from app.services import finance as fin
from app.services import finance_approval_limits as limits
from app.services.audit import write_audit
from app.services.errors import fail

COL_REQUISITIONS = "purchase_requisitions"
COL_QUOTES = "purchase_quotes"
COL_POS = "purchase_pos"
COL_LIABILITIES = "purchase_liabilities"

_WRITE_ROLES = {
    "stationerystoremanager",
    "housekeepingmanager",
    "itsupportmanager",
    "canteenmanager",
    "principal",
    "director",
    "jointdirector",
    "accounthead",
    "admin",
    "superadmin",
    "managing_director",
}
_APPROVE_ROLES = {
    "principal",
    "director",
    "jointdirector",
    "accounthead",
    "admin",
    "superadmin",
    "managing_director",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _code(db: Session, actor: User) -> str:
    return role_code_for(db, actor)


def _can_write(db: Session, actor: User) -> bool:
    code = _code(db, actor)
    perms = set(permission_codes_for(db, actor))
    return code in _WRITE_ROLES or "finance.write" in perms or "ops.write" in perms


def _can_approve(db: Session, actor: User) -> bool:
    code = _code(db, actor)
    perms = set(permission_codes_for(db, actor))
    return code in _APPROVE_ROLES or "finance.approve" in perms


def _list(db: Session, actor: User, collection: str) -> list[dict]:
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")
    rows = db.scalars(
        select(FinanceRecord)
        .where(
            FinanceRecord.campus_id == actor.campus_id,
            FinanceRecord.collection == collection,
        )
        .order_by(FinanceRecord.created_at.desc())
    ).all()
    out = []
    for row in rows:
        body = dict(row.body or {})
        body.setdefault("id", row.public_id)
        out.append(body)
    return out


def _get(db: Session, actor: User, collection: str, public_id: str) -> tuple[FinanceRecord, dict]:
    row = db.scalars(
        select(FinanceRecord).where(
            FinanceRecord.campus_id == actor.campus_id,
            FinanceRecord.collection == collection,
            FinanceRecord.public_id == str(public_id),
        )
    ).first()
    if row is None:
        fail(404, "not_found", "Purchase document not found.")
    return row, dict(row.body or {})


def _put(db: Session, actor: User, collection: str, public_id: str, body: dict) -> dict:
    row = db.scalars(
        select(FinanceRecord).where(
            FinanceRecord.campus_id == actor.campus_id,
            FinanceRecord.collection == collection,
            FinanceRecord.public_id == str(public_id),
        )
    ).first()
    payload = dict(body)
    payload["id"] = str(public_id)
    if row is None:
        row = FinanceRecord(
            id=uuid4(),
            campus_id=actor.campus_id,
            collection=collection,
            public_id=str(public_id),
            body=payload,
        )
        db.add(row)
    else:
        row.body = payload
        flag_modified(row, "body")
    db.flush()
    return payload


def list_requisitions(db: Session, actor: User) -> list[dict]:
    if not _can_write(db, actor) and "finance.read" not in set(permission_codes_for(db, actor)):
        fail(403, "forbidden", "Not allowed to view purchase requisitions.")
    return _list(db, actor, COL_REQUISITIONS)


def create_requisition(db: Session, actor: User, payload: dict) -> dict:
    if not _can_write(db, actor):
        fail(403, "forbidden", "Not allowed to create purchase requisitions.")
    if not isinstance(payload, dict):
        fail(400, "validation_error", "Body must be an object.")
    items = payload.get("items")
    if not payload.get("department") or not isinstance(items, list) or not items:
        fail(400, "validation_error", "department and items are required.")
    public_id = str(payload.get("id") or f"REQ-{uuid4().hex[:10].upper()}")
    amount = 0.0
    for item in items:
        if not isinstance(item, dict):
            continue
        qty = float(item.get("quantity") or item.get("qty") or 0)
        price = float(item.get("unitPrice") or item.get("estimatedUnitPrice") or 0)
        amount += qty * price
    if payload.get("estimatedAmount") is not None:
        amount = float(payload.get("estimatedAmount") or 0)
    body = {
        **payload,
        "id": public_id,
        "status": payload.get("status") or "Pending Quotation",
        "requestedBy": payload.get("requestedBy") or actor.email,
        "requestedByEmail": actor.email,
        "estimatedAmount": amount,
        "createdAt": payload.get("createdAt") or _now()[:10],
        "campusId": str(actor.campus_id),
        "history": list(payload.get("history") or [])
        + [{"at": _now(), "action": "created", "by": actor.email}],
    }
    saved = _put(db, actor, COL_REQUISITIONS, public_id, body)
    write_audit(
        db,
        action="purchase.requisition.create",
        entity_type="purchase_requisition",
        entity_id=public_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"amount={amount}",
    )
    db.commit()
    return {"success": True, "data": saved}


def list_quotes(db: Session, actor: User) -> list[dict]:
    if not _can_write(db, actor) and "finance.read" not in set(permission_codes_for(db, actor)):
        fail(403, "forbidden", "Not allowed to view quotes.")
    return _list(db, actor, COL_QUOTES)


def submit_quotes(db: Session, actor: User, payload: dict) -> dict:
    if not _can_write(db, actor):
        fail(403, "forbidden", "Not allowed to submit quotes.")
    quotes = payload.get("quotes") if isinstance(payload, dict) else None
    if not isinstance(quotes, list) or len(quotes) < 3:
        fail(400, "validation_error", "Procurement policy requires a minimum of 3 comparative vendor quotes.")
    if not payload.get("requisitionId") or not payload.get("selectedVendorId") or not payload.get("selectionJustification"):
        fail(400, "validation_error", "requisitionId, selectedVendorId and selectionJustification are required.")
    public_id = str(payload.get("id") or f"COMP-{uuid4().hex[:10].upper()}")
    body = {**payload, "id": public_id, "evaluationDate": payload.get("evaluationDate") or _now()[:10]}
    saved = _put(db, actor, COL_QUOTES, public_id, body)
    # Advance linked requisition
    try:
        req_row, req = _get(db, actor, COL_REQUISITIONS, str(payload["requisitionId"]))
        req["status"] = "Quoted"
        req["selectedVendorId"] = payload.get("selectedVendorId")
        req["history"] = list(req.get("history") or []) + [
            {"at": _now(), "action": "quotes_submitted", "by": actor.email}
        ]
        _put(db, actor, COL_REQUISITIONS, req_row.public_id, req)
    except Exception:
        pass
    write_audit(
        db,
        action="purchase.quotes.submit",
        entity_type="purchase_quote",
        entity_id=public_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=str(payload.get("requisitionId")),
    )
    db.commit()
    return {"success": True, "data": saved}


def list_pos(db: Session, actor: User) -> list[dict]:
    if not _can_write(db, actor) and "finance.read" not in set(permission_codes_for(db, actor)):
        fail(403, "forbidden", "Not allowed to view purchase orders.")
    return _list(db, actor, COL_POS)


def get_po(db: Session, actor: User, po_id: str) -> dict:
    if not _can_write(db, actor) and "finance.read" not in set(permission_codes_for(db, actor)):
        fail(403, "forbidden", "Not allowed to view purchase orders.")
    _, body = _get(db, actor, COL_POS, po_id)
    return body


def create_po(db: Session, actor: User, payload: dict) -> dict:
    if not _can_write(db, actor):
        fail(403, "forbidden", "Not allowed to create purchase orders.")
    if not isinstance(payload, dict):
        fail(400, "validation_error", "Body must be an object.")
    if not payload.get("vendorId") or not payload.get("vendorName") or not isinstance(payload.get("lineItems"), list):
        fail(400, "validation_error", "vendorId, vendorName and lineItems are required.")
    public_id = str(payload.get("id") or f"PO-{uuid4().hex[:10].upper()}")
    line_items = []
    subtotal = 0.0
    total_gst = 0.0
    for item in payload.get("lineItems") or []:
        if not isinstance(item, dict):
            continue
        qty = float(item.get("quantity") or 1)
        unit = float(item.get("unitPrice") or 0)
        base = qty * unit
        gst_pct = float(item.get("gstPercent") or 18)
        gst_amt = round(base * gst_pct / 100.0, 2)
        line = {
            **item,
            "subtotal": base,
            "gstPercent": gst_pct,
            "gstAmount": gst_amt,
            "total": round(base + gst_amt, 2),
        }
        line_items.append(line)
        subtotal += base
        total_gst += gst_amt
    grand = float(payload.get("grandTotal") or round(subtotal + total_gst, 2))
    body = {
        **payload,
        "id": public_id,
        "poNumber": payload.get("poNumber") or f"PO/{_now()[:4]}/{public_id[-4:]}",
        "orderDate": payload.get("orderDate") or _now()[:10],
        "status": payload.get("status") or "Pending Approval",
        "lineItems": line_items,
        "subtotal": float(payload.get("subtotal") or round(subtotal, 2)),
        "totalGst": float(payload.get("totalGst") or round(total_gst, 2)),
        "grandTotal": grand,
        "raisedBy": payload.get("raisedBy") or actor.email,
        "raisedByEmail": actor.email,
        "createdAt": _now(),
        "campusId": str(actor.campus_id),
        "history": list(payload.get("history") or [])
        + [{"at": _now(), "action": "created", "by": actor.email, "amount": grand}],
        "linkedFinanceLiabilityVoucherId": None,
    }
    # Soft evaluate for response metadata (creation always allowed; approval enforces).
    evaluation = limits.evaluate_authority(
        db, actor, amount=grand, role=_code(db, actor), category="purchase"
    )
    body["limitCheck"] = evaluation
    if evaluation.get("requiresFinance"):
        body["status"] = "Pending Finance"
        body["requiresFinanceApproval"] = True
    saved = _put(db, actor, COL_POS, public_id, body)
    write_audit(
        db,
        action="purchase.po.create",
        entity_type="purchase_order",
        entity_id=public_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"grandTotal={grand};requiresFinance={evaluation.get('requiresFinance')}",
    )
    db.commit()
    return {"success": True, "data": saved, "limitCheck": evaluation}


def _raise_finance_approval(db: Session, actor: User, po: dict, amount: float) -> str:
    state = fin.get_state(db, actor)
    data = dict(state["data"])
    approvals = list(data.get("approvals") or [])
    approval_id = f"APR-PO-{po.get('id')}"
    existing = next((a for a in approvals if a.get("id") == approval_id), None)
    if existing is None:
        approvals.insert(
            0,
            {
                "id": approval_id,
                "raisedBy": po.get("raisedBy") or actor.email,
                "department": po.get("department") or "Stores",
                "type": "Purchase Order",
                "amount": f"₹{amount:,.2f}",
                "status": "Pending",
                "linkedRequestId": po.get("id"),
                "category": "purchase",
                "createdAt": _now(),
            },
        )
        data["approvals"] = approvals
        fin.save_state(db, actor, {"data": data})
    return approval_id


def approve_po(db: Session, actor: User, po_id: str, payload: dict | None = None) -> dict:
    if not _can_approve(db, actor):
        fail(403, "forbidden", "Not allowed to approve purchase orders.")
    payload = payload or {}
    decision = str(payload.get("decision") or payload.get("status") or "approved").lower()
    row, po = _get(db, actor, COL_POS, po_id)
    amount = float(po.get("grandTotal") or 0)
    raised_by = po.get("raisedByEmail") or po.get("raisedBy")

    if decision in {"reject", "rejected", "deny", "denied"}:
        po["status"] = "Rejected"
        po["rejectedAt"] = _now()
        po["rejectedBy"] = actor.email
        po["remarks"] = payload.get("remarks") or ""
        po["history"] = list(po.get("history") or []) + [
            {"at": _now(), "action": "rejected", "by": actor.email}
        ]
        saved = _put(db, actor, COL_POS, row.public_id, po)
        write_audit(
            db,
            action="purchase.po.reject",
            entity_type="purchase_order",
            entity_id=po_id,
            actor_id=actor.id,
            campus_id=actor.campus_id,
            details=payload.get("remarks") or "",
        )
        db.commit()
        return {"success": True, "data": {"purchaseOrder": saved}}

    # Self-approval block for purchase (before escalate/approve).
    if raised_by and actor.email and str(raised_by).lower() == actor.email.lower():
        fail(403, "forbidden", "Self-approval is not allowed for this request.")

    perms = set(permission_codes_for(db, actor))
    is_finance_head = "finance.approve" in perms
    evaluation = limits.evaluate_authority(
        db, actor, amount=amount, role=_code(db, actor), category="purchase"
    )

    if evaluation.get("requiresFinance") and not is_finance_head:
        # Escalate: mark Pending Finance and create finance approval row.
        approval_id = _raise_finance_approval(db, actor, po, amount)
        po["status"] = "Pending Finance"
        po["requiresFinanceApproval"] = True
        po["financeApprovalId"] = approval_id
        po["escalatedAt"] = _now()
        po["escalatedBy"] = actor.email
        po["limitCheck"] = evaluation
        po["history"] = list(po.get("history") or []) + [
            {
                "at": _now(),
                "action": "escalated_to_finance",
                "by": actor.email,
                "message": evaluation.get("message"),
            }
        ]
        saved = _put(db, actor, COL_POS, row.public_id, po)
        write_audit(
            db,
            action="purchase.po.escalate",
            entity_type="purchase_order",
            entity_id=po_id,
            actor_id=actor.id,
            campus_id=actor.campus_id,
            details=evaluation.get("message") or "",
        )
        db.commit()
        return {
            "success": True,
            "escalated": True,
            "data": {"purchaseOrder": saved, "financeApprovalId": approval_id},
            "limitCheck": evaluation,
        }

    # Authorized approve (Finance Head override or within role limit).
    check = limits.assert_may_approve_amount(
        db,
        actor,
        amount=amount,
        category="purchase",
        raised_by_email=None,
        allow_finance_override=True,
    )

    liability_id = f"LIAB-{po_id}"
    liability = {
        "id": liability_id,
        "poId": po_id,
        "poNumber": po.get("poNumber"),
        "vendorId": po.get("vendorId"),
        "vendorName": po.get("vendorName"),
        "amount": amount,
        "status": "Open",
        "createdAt": _now(),
        "createdBy": actor.email,
    }
    _put(db, actor, COL_LIABILITIES, liability_id, liability)

    po["status"] = "Approved"
    po["approvedAt"] = _now()
    po["approvedBy"] = actor.email
    po["remarks"] = payload.get("remarks") or ""
    po["linkedFinanceLiabilityVoucherId"] = liability_id
    po["limitCheck"] = check
    po["requiresFinanceApproval"] = False
    po["history"] = list(po.get("history") or []) + [
        {"at": _now(), "action": "approved", "by": actor.email, "amount": amount}
    ]
    saved = _put(db, actor, COL_POS, row.public_id, po)

    # If a finance approval row exists, mark it approved when Finance Head clears it.
    if is_finance_head and po.get("financeApprovalId"):
        try:
            state = fin.get_state(db, actor)
            data = dict(state["data"])
            approvals = list(data.get("approvals") or [])
            for apr in approvals:
                if apr.get("id") == po.get("financeApprovalId"):
                    apr["status"] = "Approved"
                    apr["decidedAt"] = _now()
                    apr["decidedBy"] = actor.email
            data["approvals"] = approvals
            fin.save_state(db, actor, {"data": data})
        except Exception:
            pass

    write_audit(
        db,
        action="purchase.po.approve",
        entity_type="purchase_order",
        entity_id=po_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"amount={amount}",
    )
    db.commit()
    return {"success": True, "data": {"purchaseOrder": saved, "liability": liability}, "limitCheck": check}


def list_liabilities(db: Session, actor: User) -> list[dict]:
    perms = set(permission_codes_for(db, actor))
    if "finance.read" not in perms and not _can_write(db, actor):
        fail(403, "forbidden", "Not allowed to view finance liabilities.")
    return _list(db, actor, COL_LIABILITIES)


def approve_material_request(db: Session, actor: User, payload: dict) -> dict:
    """Approve a material / stationery request amount under the same limit rules."""
    if not isinstance(payload, dict):
        fail(400, "validation_error", "Body must be an object.")
    request_id = str(payload.get("requestId") or payload.get("id") or "").strip()
    amount = payload.get("amountInr", payload.get("amount"))
    if not request_id:
        fail(400, "validation_error", "requestId is required.")
    if amount is None:
        fail(400, "validation_error", "amount is required.")

    decision = str(payload.get("decision") or "approved").lower()
    raised_by = payload.get("raisedByEmail") or payload.get("raisedBy")

    if decision in {"reject", "rejected", "deny", "denied"}:
        write_audit(
            db,
            action="material_request.reject",
            entity_type="material_request",
            entity_id=request_id,
            actor_id=actor.id,
            campus_id=actor.campus_id,
            details=payload.get("remarks") or "",
        )
        db.commit()
        return {"success": True, "status": "Rejected", "requestId": request_id}

    if not _can_approve(db, actor):
        fail(403, "forbidden", "Not allowed to approve material requests.")

    evaluation = limits.evaluate_authority(
        db, actor, amount=amount, role=_code(db, actor), category="material_request"
    )
    perms = set(permission_codes_for(db, actor))
    is_finance_head = "finance.approve" in perms

    if evaluation.get("requiresFinance") and not is_finance_head:
        # Create finance approval for escalation
        state = fin.get_state(db, actor)
        data = dict(state["data"])
        approvals = list(data.get("approvals") or [])
        approval_id = f"APR-MAT-{request_id}"
        if not any(a.get("id") == approval_id for a in approvals):
            approvals.insert(
                0,
                {
                    "id": approval_id,
                    "raisedBy": raised_by or actor.email,
                    "department": payload.get("department") or "Stores",
                    "type": "Material Request",
                    "amount": f"₹{float(amount):,.2f}",
                    "status": "Pending",
                    "linkedRequestId": request_id,
                    "category": "material_request",
                    "createdAt": _now(),
                },
            )
            data["approvals"] = approvals
            fin.save_state(db, actor, {"data": data})
        write_audit(
            db,
            action="material_request.escalate",
            entity_type="material_request",
            entity_id=request_id,
            actor_id=actor.id,
            campus_id=actor.campus_id,
            details=evaluation.get("message") or "",
        )
        db.commit()
        return {
            "success": True,
            "escalated": True,
            "status": "Pending Finance",
            "requestId": request_id,
            "financeApprovalId": approval_id,
            "limitCheck": evaluation,
        }

    limits.assert_may_approve_amount(
        db,
        actor,
        amount=amount,
        category="material_request",
        raised_by_email=str(raised_by) if raised_by else None,
        allow_finance_override=True,
    )
    write_audit(
        db,
        action="material_request.approve",
        entity_type="material_request",
        entity_id=request_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"amount={amount}",
    )
    db.commit()
    return {
        "success": True,
        "status": "Approved",
        "requestId": request_id,
        "limitCheck": evaluation,
    }
