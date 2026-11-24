# Database schema (from backend)

These files are the PostgreSQL deployment schema for QMIS ERP (Alembic head `0026_audit_logs_ip_ua`, 56 tables).

- Source of truth for apply: `postgresql_schema_head.sql`
- Manifest: `schema_manifest.json`

Frontend does not connect to SQL directly; this folder is for GitHub consumers / deploy coordination with the FastAPI backend.
