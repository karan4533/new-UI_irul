"""Finance approval-limits: config, RBAC, boundary, purchase/material enforcement."""

import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["OTP_DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-qmis-erp-finance-limits"
os.environ["INTEGRATIONS_MODE"] = ""

from fastapi.testclient import TestClient

from app.main import app


def _client():
    return TestClient(app)


def _login(client: TestClient, email: str, password: str) -> dict:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_finance_head_configures_limits_assistant_cannot():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        asst = _login(client, "finance.assistant@qmis.edu", "finance123")
        teacher = _login(client, "teacher@qmis.edu", "teacher123")

        listed = client.get("/api/v1/finance/approval-limits", headers=head)
        assert listed.status_code == 200, listed.text
        rows = listed.json()["limits"]
        assert any(r["role"] == "teacher" for r in rows)

        asst_list = client.get("/api/v1/finance/approval-limits", headers=asst)
        assert asst_list.status_code == 200

        denied = client.put(
            "/api/v1/finance/approval-limits",
            headers=asst,
            json={"limits": [{"role": "teacher", "label": "Teacher", "limitInr": 1}]},
        )
        assert denied.status_code == 403

        teacher_denied = client.put(
            "/api/v1/finance/approval-limits",
            headers=teacher,
            json={"limits": [{"role": "teacher", "label": "Teacher", "limitInr": 1}]},
        )
        assert teacher_denied.status_code == 403

        saved = client.put(
            "/api/v1/finance/approval-limits",
            headers=head,
            json={
                "limits": [
                    {"role": "teacher", "label": "Teacher", "limitInr": 5000},
                    {"role": "principal", "label": "Principal", "limitInr": 50000},
                    {"role": "store", "label": "Store Officer", "limitInr": 25000},
                ]
            },
        )
        assert saved.status_code == 200, saved.text
        teacher_row = next(r for r in saved.json()["limits"] if r["role"] == "teacher")
        assert teacher_row["limitInr"] == 5000


def test_evaluate_boundaries_below_at_above():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        client.put(
            "/api/v1/finance/approval-limits",
            headers=head,
            json={"limits": [{"role": "principal", "label": "Principal", "limitInr": 50000}]},
        )
        principal = _login(client, "principal@qmis.edu", "principal123")

        below = client.post(
            "/api/v1/finance/approval-limits/evaluate",
            headers=principal,
            json={"amountInr": 49999, "role": "principal", "category": "purchase"},
        )
        assert below.status_code == 200
        assert below.json()["withinLimit"] is True
        assert below.json()["requiresFinance"] is False

        at_limit = client.post(
            "/api/v1/finance/approval-limits/evaluate",
            headers=principal,
            json={"amountInr": 50000, "role": "principal", "category": "purchase"},
        )
        assert at_limit.json()["withinLimit"] is True

        above = client.post(
            "/api/v1/finance/approval-limits/evaluate",
            headers=principal,
            json={"amountInr": 50001, "role": "principal", "category": "purchase"},
        )
        assert above.json()["withinLimit"] is False
        assert above.json()["requiresFinance"] is True


def test_purchase_po_escalates_then_finance_approves():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        client.put(
            "/api/v1/finance/approval-limits",
            headers=head,
            json={"limits": [{"role": "principal", "label": "Principal", "limitInr": 10000}]},
        )
        store = _login(client, "stationerystoremanager@qmis.edu", "stationery123")
        principal = _login(client, "principal@qmis.edu", "principal123")

        created = client.post(
            "/api/v1/purchase/pos",
            headers=store,
            json={
                "vendorId": "V-1",
                "vendorName": "Acme Supplies",
                "department": "Stores",
                "lineItems": [{"quantity": 1, "unitPrice": 25000, "gstPercent": 0}],
            },
        )
        assert created.status_code == 200, created.text
        po = created.json()["data"]
        po_id = po["id"]
        assert po.get("requiresFinanceApproval") is True or po.get("status") == "Pending Finance"

        escalated = client.post(
            f"/api/v1/purchase/pos/{po_id}/approve",
            headers=principal,
            json={"decision": "approved"},
        )
        assert escalated.status_code == 200, escalated.text
        body = escalated.json()
        assert body.get("escalated") is True
        assert body["data"]["purchaseOrder"]["status"] == "Pending Finance"
        approval_id = body["data"]["financeApprovalId"]

        # Assistant cannot approve
        asst = _login(client, "finance.assistant@qmis.edu", "finance123")
        denied = client.post(
            "/api/v1/finance/actions/decide-approval",
            headers=asst,
            json={"approvalId": approval_id, "decision": "approved"},
        )
        assert denied.status_code == 403

        approved = client.post(
            "/api/v1/finance/actions/decide-approval",
            headers=head,
            json={"approvalId": approval_id, "decision": "approved", "remarks": "within campus"},
        )
        assert approved.status_code == 200, approved.text
        assert approved.json()["approval"]["status"] == "Approved"

        po_after = client.get(f"/api/v1/purchase/pos/{po_id}", headers=head)
        assert po_after.status_code == 200
        assert po_after.json()["status"] == "Approved"


def test_purchase_within_limit_approves_directly():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        client.put(
            "/api/v1/finance/approval-limits",
            headers=head,
            json={"limits": [{"role": "principal", "label": "Principal", "limitInr": 100000}]},
        )
        store = _login(client, "stationerystoremanager@qmis.edu", "stationery123")
        principal = _login(client, "principal@qmis.edu", "principal123")
        created = client.post(
            "/api/v1/purchase/pos",
            headers=store,
            json={
                "vendorId": "V-2",
                "vendorName": "Local Vendor",
                "lineItems": [{"quantity": 2, "unitPrice": 1000, "gstPercent": 0}],
            },
        )
        po_id = created.json()["data"]["id"]
        approved = client.post(
            f"/api/v1/purchase/pos/{po_id}/approve",
            headers=principal,
            json={"decision": "approved"},
        )
        assert approved.status_code == 200, approved.text
        assert approved.json().get("escalated") is not True
        assert approved.json()["data"]["purchaseOrder"]["status"] == "Approved"


def test_material_request_decide_escalates_over_limit():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        client.put(
            "/api/v1/finance/approval-limits",
            headers=head,
            json={"limits": [{"role": "store", "label": "Store", "limitInr": 5000}]},
        )
        # Use principal as approver with store-equivalent check via payload role path
        principal = _login(client, "principal@qmis.edu", "principal123")
        client.put(
            "/api/v1/finance/approval-limits",
            headers=head,
            json={"limits": [{"role": "principal", "label": "Principal", "limitInr": 1000}]},
        )
        result = client.post(
            "/api/v1/purchase/material-requests/decide",
            headers=principal,
            json={
                "requestId": "MAT-TEST-1",
                "amount": 5000,
                "department": "Stationery",
                "decision": "approved",
            },
        )
        assert result.status_code == 200, result.text
        assert result.json().get("escalated") is True
        assert result.json()["status"] == "Pending Finance"


def test_self_approval_blocked_on_po():
    with _client() as client:
        head = _login(client, "accounthead@qmis.edu", "accounts123")
        client.put(
            "/api/v1/finance/approval-limits",
            headers=head,
            json={"limits": [{"role": "principal", "label": "Principal", "limitInr": 999999}]},
        )
        principal = _login(client, "principal@qmis.edu", "principal123")
        created = client.post(
            "/api/v1/purchase/pos",
            headers=principal,
            json={
                "vendorId": "V-3",
                "vendorName": "Self Co",
                "lineItems": [{"quantity": 1, "unitPrice": 100, "gstPercent": 0}],
            },
        )
        po_id = created.json()["data"]["id"]
        blocked = client.post(
            f"/api/v1/purchase/pos/{po_id}/approve",
            headers=principal,
            json={"decision": "approved"},
        )
        # Creator email == principal email → self-approval blocked
        assert blocked.status_code == 403
