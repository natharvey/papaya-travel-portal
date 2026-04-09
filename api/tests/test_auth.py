import pytest
from fastapi.testclient import TestClient


def test_admin_login_success(client: TestClient):
    response = client.post("/auth/admin-login", json={"password": "testpass"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "admin"
    assert data["token_type"] == "bearer"


def test_admin_login_wrong_password(client: TestClient):
    response = client.post("/auth/admin-login", json={"password": "wrongpassword"})
    assert response.status_code == 401
    assert "Invalid" in response.json()["detail"]
