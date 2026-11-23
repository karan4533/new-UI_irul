"""Ensure audit_logs.ip_address / user_agent exist (Alembic 0025)."""

from __future__ import annotations

from sqlalchemy import inspect, text

from app.core.database import engine


def ensure_audit_schema() -> None:
    """Best-effort ADD COLUMN when create_all cannot alter existing tables."""
    try:
        inspector = inspect(engine)
        if not inspector.has_table("audit_logs"):
            return
        cols = {c["name"] for c in inspector.get_columns("audit_logs")}
        statements: list[str] = []
        if "ip_address" not in cols:
            statements.append("ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(64)")
        if "user_agent" not in cols:
            statements.append("ALTER TABLE audit_logs ADD COLUMN user_agent VARCHAR(512)")
        if not statements:
            return
        with engine.begin() as conn:
            if engine.dialect.name == "postgresql":
                conn.execute(text("SET LOCAL lock_timeout = '5s'"))
            for sql in statements:
                conn.execute(text(sql))
    except Exception:
        # Never block API startup; audit list still works with null IP/UA.
        return
