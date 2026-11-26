"""Campus Finance approval-limit configuration and spend authority checks."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import permission_codes_for, role_code_for
from app.models import User
from app.models.base import utcnow
from app.models.finance_approval_limits import LIMIT_CATEGORIES, FinanceApprovalLimit
from app.services.audit import write_audit
from app.services.errors import fail

DEFAULT_LIMIT_ROWS: tuple[dict, ...] = (
    {"role_code": "teacher", "role_label": "Teacher", "limit_inr": Decimal("5000")},
    {"role_code": "coordinator", "role_label": "Coordinator", "limit_inr": Decimal("15000")},
    {"role_code": "principal", "role_label": "Principal", "limit_inr": Decimal("50000")},
    {"role_code": "director", "role_label": "Director / DA", "limit_inr": Decimal("100000")},
    {"role_code": "jointdirector", "role_label": "Joint Director", "limit_inr": Decimal("200000")},
    {"role_code": "store", "role_label": "Store Officer", "limit_inr": Decimal("25000")},
    {"role_code": "accounthead", "role_label": "Account Head (Finance Head)", "limit_inr": Decimal("500000")},
)

ROLE_ALIASES = {
    "stationerystoremanager": "store",
    "housekeepingmanager": "store",
    "itsupportmanager": "store",
    "canteenmanager": "store",
    "jointdirectoroperations": "jointdirector",
    "jointdirectoraudit": "jointdirector",
    "managingdirector": "director",
    "managing_director": "director",
    "financeassistant": "accounthead",
    "finance_assistant": "accounthead",
    "account_head": "accounthead",
}


def _norm_role(role: str | None) -> str:
    return "".join(ch for ch in str(role or "").lower() if ch.isalnum() or ch == "_").replace("__", "_")


def _lookup_role(role: str | None) -> str:
    key = _norm_role(role)
    compact = key.replace("_", "")
    if key in ROLE_ALIASES:
        return ROLE_ALIASES[key]
    if compact in ROLE_ALIASES:
        return ROLE_ALIASES[compact]
    return key


def _as_money(value, *, field: str = "amount") -> Decimal:
    if isinstance(value, Decimal):
        amount = value
    else:
        raw = str(value or "").strip()
        digits = "".join(ch for ch in raw if ch.isdigit() or ch in ".-")
        try:
            amount = Decimal(digits or "0")
        except (InvalidOperation, ValueError):
            fail(400, "validation_error", f"{field} must be a number.")
    if amount < 0:
        fail(400, "validation_error", f"{field} cannot be negative.")
    return amount.quantize(Decimal("0.01"))


def _category(value: str | None) -> str:
    cat = str(value or "general").strip().lower() or "general"
    if cat not in LIMIT_CATEGORIES:
        fail(400, "validation_error", f"category must be one of: {', '.join(LIMIT_CATEGORIES)}")
    return cat


def _serialize(row: FinanceApprovalLimit) -> dict:
    return {
        "id": str(row.id),
        "role": row.role_code,
        "roleCode": row.role_code,
        "label": row.role_label,
        "category": row.category,
        "limitInr": float(row.limit_inr),
        "updatedBy": str(row.updated_by) if row.updated_by else None,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


def _ensure_defaults(db: Session, campus_id) -> None:
    existing = {
        (r.role_code, r.category)
        for r in db.scalars(
            select(FinanceApprovalLimit).where(FinanceApprovalLimit.campus_id == campus_id)
        ).all()
    }
    created = False
    for seed in DEFAULT_LIMIT_ROWS:
        key = (seed["role_code"], "general")
        if key in existing:
            continue
        db.add(
            FinanceApprovalLimit(
                id=uuid4(),
                campus_id=campus_id,
                role_code=seed["role_code"],
                role_label=seed["role_label"],
                category="general",
                limit_inr=seed["limit_inr"],
            )
        )
        created = True
    if created:
        db.flush()


def list_limits(db: Session, actor: User, category: str | None = None) -> dict:
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")
    _ensure_defaults(db, actor.campus_id)
    q = select(FinanceApprovalLimit).where(FinanceApprovalLimit.campus_id == actor.campus_id)
    if category:
        q = q.where(FinanceApprovalLimit.category == _category(category))
    rows = list(db.scalars(q.order_by(FinanceApprovalLimit.role_code, FinanceApprovalLimit.category)).all())
    db.commit()
    return {
        "success": True,
        "limits": [_serialize(r) for r in rows],
        "categories": list(LIMIT_CATEGORIES),
    }


def replace_limits(db: Session, actor: User, payload: dict) -> dict:
    perms = set(permission_codes_for(db, actor))
    if "finance.write" not in perms:
        fail(403, "forbidden", "Only Finance Head can configure approval limits.")
    if not actor.campus_id:
        fail(400, "validation_error", "Campus context required.")

    items = payload.get("limits") if isinstance(payload, dict) else None
    if not isinstance(items, list) or not items:
        fail(400, "validation_error", "limits must be a non-empty list.")

    category_default = _category(payload.get("category") if isinstance(payload, dict) else None)
    _ensure_defaults(db, actor.campus_id)

    changed: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            fail(400, "validation_error", "Each limit row must be an object.")
        role_code = _lookup_role(item.get("role") or item.get("roleCode"))
        if not role_code:
            fail(400, "validation_error", "role is required.")
        category = _category(item.get("category") or category_default)
        limit = _as_money(item.get("limitInr", item.get("limit")), field="limitInr")
        label = str(item.get("label") or item.get("roleLabel") or role_code).strip() or role_code

        row = db.scalars(
            select(FinanceApprovalLimit).where(
                FinanceApprovalLimit.campus_id == actor.campus_id,
                FinanceApprovalLimit.role_code == role_code,
                FinanceApprovalLimit.category == category,
            )
        ).first()
        before = float(row.limit_inr) if row else None
        if row is None:
            row = FinanceApprovalLimit(
                id=uuid4(),
                campus_id=actor.campus_id,
                role_code=role_code,
                role_label=label,
                category=category,
                limit_inr=limit,
                updated_by=actor.id,
            )
            db.add(row)
        else:
            row.role_label = label
            row.limit_inr = limit
            row.updated_by = actor.id
            row.updated_at = utcnow()
        changed.append(
            {
                "role": role_code,
                "category": category,
                "before": before,
                "after": float(limit),
            }
        )

    write_audit(
        db,
        action="finance.approval_limits.update",
        entity_type="finance_approval_limits",
        entity_id=str(actor.campus_id),
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=str(changed)[:2000],
    )
    db.commit()
    return list_limits(db, actor, category=None)


def get_limit_for_role(
    db: Session,
    *,
    campus_id,
    role: str | None,
    category: str = "general",
) -> Decimal | None:
    if not campus_id:
        return None
    _ensure_defaults(db, campus_id)
    lookup = _lookup_role(role)
    cat = _category(category)
    row = db.scalars(
        select(FinanceApprovalLimit).where(
            FinanceApprovalLimit.campus_id == campus_id,
            FinanceApprovalLimit.role_code == lookup,
            FinanceApprovalLimit.category == cat,
        )
    ).first()
    if row is None and cat != "general":
        row = db.scalars(
            select(FinanceApprovalLimit).where(
                FinanceApprovalLimit.campus_id == campus_id,
                FinanceApprovalLimit.role_code == lookup,
                FinanceApprovalLimit.category == "general",
            )
        ).first()
    return Decimal(row.limit_inr) if row is not None else None


def evaluate_authority(
    db: Session,
    actor: User,
    *,
    amount,
    role: str | None = None,
    category: str = "general",
) -> dict:
    """Return whether the given role may approve/spend ``amount`` under campus limits."""
    amount_dec = _as_money(amount, field="amount")
    actor_role = role_code_for(db, actor)
    check_role = role or actor_role
    perms = set(permission_codes_for(db, actor))
    is_finance_head = "finance.approve" in perms and actor_role in {"accounthead", "admin", "superadmin", "managing_director"}

    limit = get_limit_for_role(
        db,
        campus_id=actor.campus_id,
        role=check_role,
        category=category,
    )

    # Finance Head with approve may clear any escalated request (campus authority).
    if is_finance_head and _lookup_role(check_role) in {"accounthead", "admin", "superadmin", "managing_director"}:
        return {
            "withinLimit": True,
            "requiresFinance": False,
            "limitInr": float(limit) if limit is not None else None,
            "amountInr": float(amount_dec),
            "role": _lookup_role(check_role),
            "category": _category(category),
            "message": "Finance Head authority covers this amount.",
            "authorized": True,
        }

    if limit is None:
        return {
            "withinLimit": False,
            "requiresFinance": True,
            "limitInr": None,
            "amountInr": float(amount_dec),
            "role": _lookup_role(check_role),
            "category": _category(category),
            "message": "No Finance approval limit configured for this role — route via Finance.",
            "authorized": False,
        }

    within = amount_dec <= limit
    return {
        "withinLimit": within,
        "requiresFinance": not within,
        "limitInr": float(limit),
        "amountInr": float(amount_dec),
        "role": _lookup_role(check_role),
        "category": _category(category),
        "message": (
            f"Within ₹{limit:,.2f} role limit."
            if within
            else f"₹{amount_dec:,.2f} exceeds ₹{limit:,.2f} limit — escalate to Finance."
        ),
        "authorized": within,
    }


def assert_may_approve_amount(
    db: Session,
    actor: User,
    *,
    amount,
    category: str = "general",
    raised_by_email: str | None = None,
    allow_finance_override: bool = True,
) -> dict:
    """Fail with 403 when actor may not approve ``amount`` (API enforcement)."""
    if raised_by_email and actor.email and raised_by_email.lower() == actor.email.lower():
        perms = set(permission_codes_for(db, actor))
        # Finance Head may clear own-raised operational claims only when explicitly finance.approve
        # and not a self-raised purchase; block self-approval for purchase/material.
        if category in {"purchase", "material_request"} or "finance.approve" not in perms:
            fail(403, "forbidden", "Self-approval is not allowed for this request.")

    perms = set(permission_codes_for(db, actor))
    actor_role = role_code_for(db, actor)
    if allow_finance_override and "finance.approve" in perms and actor_role in {
        "accounthead",
        "admin",
        "superadmin",
        "managing_director",
    }:
        return {
            "withinLimit": True,
            "requiresFinance": False,
            "limitInr": None,
            "amountInr": float(_as_money(amount)),
            "authorized": True,
            "message": "Finance Head override.",
        }

    result = evaluate_authority(db, actor, amount=amount, role=actor_role, category=category)
    if not result.get("authorized"):
        fail(403, "approval_limit_exceeded", result["message"])
    return result


def evaluate_payload(db: Session, actor: User, payload: dict) -> dict:
    amount = payload.get("amountInr", payload.get("amount"))
    role = payload.get("role") or payload.get("actorRole")
    category = payload.get("category") or "general"
    result = evaluate_authority(db, actor, amount=amount, role=role, category=category)
    return {"success": True, **result}
