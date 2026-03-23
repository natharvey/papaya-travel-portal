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


def test_client_login_success(client: TestClient, sample_intake_data: dict):
    # First create a client via intake
    intake_response = client.post("/intake", json=sample_intake_data)
    assert intake_response.status_code == 200
    intake_data = intake_response.json()

    # Now log in with the credentials
    login_response = client.post(
        "/auth/client-login",
        json={
            "email": intake_data["email"],
            "reference_code": intake_data["reference_code"],
        },
    )
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert "access_token" in login_data
    assert login_data["role"] == "client"


def test_client_login_wrong_reference_code(client: TestClient, sample_intake_data: dict):
    # Create a client
    intake_data = sample_intake_data.copy()
    intake_data["client_email"] = "wrongref@example.com"
    client.post("/intake", json=intake_data)

    # Try logging in with wrong reference code
    response = client.post(
        "/auth/client-login",
        json={"email": "wrongref@example.com", "reference_code": "BADCODE1"},
    )
    assert response.status_code == 401
    assert "Invalid" in response.json()["detail"]


def test_client_login_nonexistent_email(client: TestClient):
    response = client.post(
        "/auth/client-login",
        json={"email": "nobody@example.com", "reference_code": "FAKECODE"},
    )
    assert response.status_code == 401
