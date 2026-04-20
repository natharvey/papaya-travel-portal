import pytest
from fastapi.testclient import TestClient


def test_intake_creates_client_and_trip(client: TestClient, sample_intake_data: dict):
    intake_data = sample_intake_data.copy()
    intake_data["client_email"] = "newclient1@example.com"

    response = client.post("/intake", json=intake_data)
    assert response.status_code == 200

    data = response.json()
    assert data["email"] == "newclient1@example.com"
    assert "trip_id" in data
    assert data["trip_id"] is not None



def test_intake_returns_message_with_credentials(client: TestClient, sample_intake_data: dict):
    intake_data = sample_intake_data.copy()
    intake_data["client_email"] = "messagetest@example.com"

    response = client.post("/intake", json=intake_data)
    assert response.status_code == 200

    data = response.json()
    assert "message" in data
    assert "messagetest@example.com" in data["message"]


def test_rapid_resubmission_is_blocked(client: TestClient, sample_intake_data: dict):
    """Second intake from the same client within 10 minutes is blocked with 429."""
    intake_data = sample_intake_data.copy()
    intake_data["client_email"] = "duplicate@example.com"

    r1 = client.post("/intake", json=intake_data)
    assert r1.status_code == 200

    intake_data2 = intake_data.copy()
    intake_data2["trip_title"] = "Second Trip"
    r2 = client.post("/intake", json=intake_data2)
    assert r2.status_code == 429


def test_different_clients_can_submit_independently(client: TestClient, sample_intake_data: dict):
    """Two different email addresses can each create a trip without interference."""
    data_a = sample_intake_data.copy()
    data_a["client_email"] = "clienta@example.com"
    data_b = sample_intake_data.copy()
    data_b["client_email"] = "clientb@example.com"

    r1 = client.post("/intake", json=data_a)
    r2 = client.post("/intake", json=data_b)
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["trip_id"] != r2.json()["trip_id"]


def test_intake_validates_required_fields(client: TestClient):
    # Missing required fields
    response = client.post("/intake", json={"client_name": "Test"})
    assert response.status_code == 422


def test_intake_invalid_email(client: TestClient, sample_intake_data: dict):
    intake_data = sample_intake_data.copy()
    intake_data["client_email"] = "not-an-email"

    response = client.post("/intake", json=intake_data)
    assert response.status_code == 422
