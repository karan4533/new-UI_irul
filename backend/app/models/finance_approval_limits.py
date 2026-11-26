import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow

LIMIT_CATEGORIES = (
    "general",
    "purchase",
    "material_request",
    "expense",
    "salary_advance",
)


class FinanceApprovalLimit(Base):
    """Campus per-role spend/approval cap set by Finance Head."""

    __tablename__ = "finance_approval_limits"
    __table_args__ = (
        UniqueConstraint(
            "campus_id",
            "role_code",
            "category",
            name="uq_finance_approval_limits_campus_role_cat",
        ),
        CheckConstraint(
            "category IN ("
            "'general', 'purchase', 'material_request', 'expense', 'salary_advance'"
            ")",
            name="ck_finance_approval_limits_category",
        ),
        CheckConstraint("limit_inr >= 0", name="ck_finance_approval_limits_nonneg"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    campus_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campuses.id"), nullable=False, index=True)
    role_code: Mapped[str] = mapped_column(String(64), nullable=False)
    role_label: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    category: Mapped[str] = mapped_column(String(40), default="general", nullable=False)
    limit_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"), nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
