"""Parents and students hold finance.read for their own fees only; every campus finance read must refuse them."""

from __future__ import annotations

import os

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["INTEGRATIONS_MODE"] = ""

import pytest
from fastapi.testclient import TestClient

from app.main import app

PORTAL_ALLOWED = {"/api/v1/finance/my-fees"}


def _finance_reads() -> list[str]:
    paths = []
    for path, operations in app.openapi()["paths"].items():
        if "get" not in operations or not path.startswith("/api/v1/finance") or path in PORTAL_ALLOWED:
            continue
        paths.append(path.replace("{collection}", "transactions"))
    return sorted(set(paths))


def _login(client: TestClient, email: str, password: str) -> dict:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_campus_finance_reads_are_enumerated():
    reads = _finance_reads()
    assert "/api/v1/finance/state" in reads
    assert "/api/v1/finance/actions/report-pack" in reads


@pytest.mark.parametrize("email,password", [("parent@qmis.edu", "parent123"), ("student@qmis.edu", "student123")])
def test_portal_users_cannot_read_campus_finance(email, password):
    with TestClient(app) as client:
        headers = _login(client, email, password)
        leaked = []
        for path in _finance_reads():
            response = client.get(path, headers=headers)
            if response.status_code != 403:
                leaked.append(f"{path} -> {response.status_code}")
        assert not leaked, "portal user reached campus finance data:\n" + "\n".join(leaked)
        assert client.get("/api/v1/finance/my-fees", headers=headers).status_code == 200
