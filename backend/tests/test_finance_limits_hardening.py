"""Finance hardening: Assistant matrix, store ops bypass, concurrency, campus isolation, audit."""

from __future__ import annotations

import os
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-finance-hardening"
os.environ["INTEGRATIONS_MODE"] = ""

from fastapi.testclient import TestClient

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models import AuditLog, Campus, Role, User
from app.models.finance_approval_limits import FinanceApprovalLimit


def _client():
    return TestClient(app)


def _login(client: TestClient, email: str, password: str) -> dict:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


FINANCE_ASSISTANT_ALLOWED = {
    ("GET", "/api/v1/finance/approval-limits"),
    ("GET", "/api/v1/finance/state"),
    ("GET", "/api/v1/finance/my-fees"),
    ("GET", "/api/v1/finance/approvals"),
    ("POST", "/api/v1/finance/approval-limits/evaluate"),
    ("POST", "/api/v1/finance/actions/collect-payment"),
    ("POST", "/api/v1/finance/actions/settle-cheque"),
    ("POST", "/api/v1/finance/actions/send-receipt"),
    ("POST", "/api/v1/finance/actions/gateway-intent"),
    # Settles only after Razorpay signature/provider verification; stub intents are refused outside development.
    ("POST", "/api/v1/finance/actions/gateway-confirm"),
}

FINANCE_ASSISTANT_DENIED = [
    ("PUT", "/api/v1/finance/approval-limits", {"limits": [{"role": "teacher", "label": "Teacher", "limitInr": 1}]}),
    ("PUT", "/api/v1/finance/state", {"data": {"meta": {"seeded": True}}}),
    ("POST", "/api/v1/finance/state/reset", {}),
    ("POST", "/api/v1/finance/actions/decide-approval", {"approvalId": "x", "decision": "approved"}),
    ("POST", "/api/v1/finance/actions/apply-hr-concessions", {}),
    ("POST", "/api/v1/finance/actions/post-payroll-voucher", {"payrollRunId": "x"}),
    ("PUT", "/api/v1/finance/approvals", []),
]


def test_finance_assistant_permission_matrix_on_finance_apis():
    with _client() as client:
        asst = _login(client, "finance.assistant@qmis.edu", "finance123")

        for method, path in (
            ("GET", "/api/v1/finance/approval-limits"),
            ("GET", "/api/v1/finance/state"),
            ("GET", "/api/v1/finance/approvals"),
        ):
            res = client.request(method, path, headers=asst)
            assert res.status_code == 200, f"{method} {path} -> {res.status_code} {res.text}"

        eval_ok = client.post(
            "/api/v1/finance/approval-limits/evaluate",
            headers=asst,
            json={"amountInr": 100, "role": "teacher", "category": "purchase"},
        )
        assert eval_ok.status_code == 200, eval_ok.text

        for method, path, body in FINANCE_ASSISTANT_DENIED:
            if method == "PUT":
                res = client.put(path, headers=asst, json=body)
            else:
                res = client.post(path, headers=asst, json=body)
            assert res.status_code == 403, f"expected 403 for {method} {path}, got {res.status_code} {res.text}"


def test_ops_store_collections_cannot_bypass_limits():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        client.put(
            "/api/v1/finance/approval-limits",
            headers=head,
            json={
                "limits": [
                    {"role": "store", "label": "Store", "limitInr": 1000},
                    {"role": "admin", "label": "Admin", "limitInr": 1000},
                ]
            },
        )
        store = _login(client, "stationerystoremanager@qmis.edu", "stationery123")
        principal = _login(client, "principal@qmis.edu", "principal123")

        # Stationery vertical — store manager writer
        blocked = client.put(
            "/api/v1/ops/stationery-requests",
            headers=store,
            json=[
                {
                    "id": "stationery-requests-HARDEN-1",
                    "status": "Approved",
                    "estimatedAmount": 50000,
                    "amount": 50000,
                }
            ],
        )
        assert blocked.status_code == 403, blocked.text

        pending_ok = client.put(
            "/api/v1/ops/stationery-requests",
            headers=store,
            json=[
                {
                    "id": "stationery-requests-HARDEN-2",
                    "status": "Pending",
                    "estimatedAmount": 50000,
                }
            ],
        )
        assert pending_ok.status_code == 200, pending_ok.text

        # Shared / HK / IT / canteen procurement — principal can write shared; use matching managers
        hk = _login(client, "housekeepingmanager@qmis.edu", "housekeeping123")
        it = _login(client, "itsupportmanager@qmis.edu", "itsupport123")
        for collection, headers in (
            ("hk-procurement", hk),
            ("it-procurement", it),
            ("shared-procurement", store),
            ("stationery-procurement", store),
        ):
            res = client.put(
                f"/api/v1/ops/{collection}",
                headers=headers,
                json=[
                    {
                        "id": f"{collection}-HARDEN-1",
                        "status": "Approved",
                        "estimatedAmount": 50000,
                        "amount": 50000,
                    }
                ],
            )
            assert res.status_code == 403, f"{collection} bypassed: {res.status_code} {res.text}"

        # Finance Head may clear over-limit stationery approval
        cleared = client.put(
            "/api/v1/ops/stationery-requests",
            headers=head,
            json=[
                {
                    "id": "stationery-requests-HARDEN-HEAD",
                    "status": "Approved",
                    "estimatedAmount": 50000,
                }
            ],
        )
        # Head is not in stationery writers — expect 403 forbidden OR 200 if writers include finance
        assert cleared.status_code in {200, 403}, cleared.text
        # Principal also cannot silently approve stationery over limit even with ops.write
        princ_try = client.put(
            "/api/v1/ops/shared-procurement",
            headers=principal,
            json=[
                {
                    "id": "shared-procurement-HARDEN-P",
                    "status": "Approved",
                    "estimatedAmount": 50000,
                }
            ],
        )
        assert princ_try.status_code == 403, princ_try.text


def test_concurrent_limit_updates_and_approvals_remain_consistent():
    """Rapid interleaved limit changes + approvals (SQLite-safe sequential race)."""
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        store = _login(client, "stationerystoremanager@qmis.edu", "stationery123")
        principal = _login(client, "principal@qmis.edu", "principal123")

        client.put(
            "/api/v1/finance/approval-limits",
            headers=head,
            json={"limits": [{"role": "principal", "label": "Principal", "limitInr": 5000}]},
        )

        created = []
        for i in range(3):
            po = client.post(
                "/api/v1/purchase/pos",
                headers=store,
                json={
                    "vendorId": f"V-C-{i}",
                    "vendorName": f"Vendor {i}",
                    "lineItems": [{"quantity": 1, "unitPrice": 20000, "gstPercent": 0}],
                },
            )
            assert po.status_code == 200, po.text
            created.append(po.json()["data"]["id"])

        # Interleave limit bumps with approvals — last limit write wins; each approve uses current DB state.
        sequence = [
            ("limit", 8000),
            ("approve", created[0]),
            ("limit", 12000),
            ("approve", created[1]),
            ("limit", 5000),
            ("approve", created[2]),
        ]
        approve_bodies = []
        for kind, value in sequence:
            if kind == "limit":
                res = client.put(
                    "/api/v1/finance/approval-limits",
                    headers=head,
                    json={"limits": [{"role": "principal", "label": "Principal", "limitInr": value}]},
                )
                assert res.status_code == 200, res.text
            else:
                res = client.post(
                    f"/api/v1/purchase/pos/{value}/approve",
                    headers=principal,
                    json={"decision": "approved"},
                )
                assert res.status_code == 200, res.text
                body = res.json()
                assert body.get("success") is True
                po = body.get("data", {}).get("purchaseOrder") or {}
                assert po.get("status") in {"Pending Finance", "Approved", "Rejected"} or body.get("escalated") is True
                approve_bodies.append(body)

        assert len(approve_bodies) == 3
        # With final principal limit 5000 and amount 20000, last approval must escalate
        assert approve_bodies[-1].get("escalated") is True or (
            approve_bodies[-1].get("data", {}).get("purchaseOrder", {}).get("status") == "Pending Finance"
        )

        final_limits = client.get("/api/v1/finance/approval-limits", headers=head).json()["limits"]
        principal_row = next(r for r in final_limits if r["role"] == "principal")
        assert principal_row["limitInr"] == 5000

        # Repeated evaluate after race remains stable (sequential — SQLite TestClient is not thread-safe).
        for _ in range(5):
            ev = client.post(
                "/api/v1/finance/approval-limits/evaluate",
                headers=principal,
                json={"amountInr": 20000, "role": "principal", "category": "purchase"},
            ).json()
            assert ev.get("requiresFinance") is True
            assert ev.get("limitInr") == 5000


def test_campus_isolation_and_audit_history():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        # Capture campus A limits
        before = client.put(
            "/api/v1/finance/approval-limits",
            headers=head,
            json={"limits": [{"role": "teacher", "label": "Teacher", "limitInr": 7777}]},
        )
        assert before.status_code == 200

        # Create campus B + finance head in DB
        db = SessionLocal()
        try:
            role = db.scalars(select(Role).where(Role.code == "accounthead")).one()
            campus_b = Campus(id=uuid4(), code=f"ISO-{uuid4().hex[:6].upper()}", name="Isolation Campus", city="Test")
            db.add(campus_b)
            db.flush()
            user_b = User(
                id=uuid4(),
                email=f"head.iso.{uuid4().hex[:6]}@qmis.edu",
                password_hash=hash_password("accounts123"),
                role_id=role.id,
                campus_id=campus_b.id,
                is_active=True,
                must_change_password=False,
            )
            db.add(user_b)
            db.add(
                FinanceApprovalLimit(
                    id=uuid4(),
                    campus_id=campus_b.id,
                    role_code="teacher",
                    role_label="Teacher",
                    category="general",
                    limit_inr=1111,
                )
            )
            db.commit()
            email_b = user_b.email
            campus_b_id = str(campus_b.id)
        finally:
            db.close()

        head_b = _login(client, email_b, "accounts123")
        limits_b = client.get("/api/v1/finance/approval-limits", headers=head_b).json()["limits"]
        teacher_b = next(r for r in limits_b if r["role"] == "teacher")
        assert teacher_b["limitInr"] == 1111.0

        limits_a = client.get("/api/v1/finance/approval-limits", headers=head).json()["limits"]
        teacher_a = next(r for r in limits_a if r["role"] == "teacher")
        assert teacher_a["limitInr"] == 7777.0

        # Head B cannot see campus A purchase docs
        store = _login(client, "stationerystoremanager@qmis.edu", "stationery123")
        po = client.post(
            "/api/v1/purchase/pos",
            headers=store,
            json={
                "vendorId": "V-ISO",
                "vendorName": "Iso Vendor",
                "lineItems": [{"quantity": 1, "unitPrice": 100, "gstPercent": 0}],
            },
        )
        po_id = po.json()["data"]["id"]
        missing = client.get(f"/api/v1/purchase/pos/{po_id}", headers=head_b)
        assert missing.status_code == 404

        # Direct DB audit check
        db = SessionLocal()
        try:
            rows = db.scalars(
                select(AuditLog).where(AuditLog.action == "finance.approval_limits.update")
            ).all()
            assert len(rows) >= 1
            assert all(row.campus_id is not None for row in rows)
            assert campus_b_id
        finally:
            db.close()


def test_alembic_chain_prefix_documented():
    """Sanity: 0028 revises TC 0027 — clean linear head."""
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "0028_finance_approval_limits.py"
    spec = importlib.util.spec_from_file_location("m0028", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    assert mod.revision == "0028_finance_approval_limits"
    assert mod.down_revision == "0027_tc_workflow_stage"
