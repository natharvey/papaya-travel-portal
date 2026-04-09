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


def test_intake_returns_reference_code(client: TestClient, sample_intake_data: dict):
    intake_data = sample_intake_data.copy()
    intake_data["client_email"] = "refcodetest@example.com"

    response = client.post("/intake", json=intake_data)
    assert response.status_code == 200

    data = response.json()
    assert "reference_code" in data
    ref = data["reference_code"]
    assert len(ref) == 8
    assert ref.isalnum()
    assert ref == ref.upper()


def test_intake_returns_message_with_credentials(client: TestClient, sample_intake_data: dict):
    intake_data = sample_intake_data.copy()
    intake_data["client_email"] = "messagetest@example.com"

    response = client.post("/intake", json=intake_data)
    assert response.status_code == 200

    data = response.json()
    assert "message" in data
    assert "messagetest@example.com" in data["message"]


def test_duplicate_email_creates_new_trip(client: TestClient, sample_intake_data: dict):
    intake_data = sample_intake_data.copy()
    intake_data["client_email"] = "duplicate@example.com"

    # First submission
    r1 = client.post("/intake", json=intake_data)
    assert r1.status_code == 200
    d1 = r1.json()

    # Second submission with same email — different trip
    intake_data2 = intake_data.copy()
    intake_data2["trip_title"] = "Second Trip"
    r2 = client.post("/intake", json=intake_data2)
    assert r2.status_code == 200
    d2 = r2.json()

    # Same email and reference code (same client)
    assert d1["email"] == d2["email"]
    assert d1["reference_code"] == d2["reference_code"]
    # But different trip IDs
    assert d1["trip_id"] != d2["trip_id"]


def test_intake_validates_required_fields(client: TestClient):
    # Missing required fields
    response = client.post("/intake", json={"client_name": "Test"})
    assert response.status_code == 422


def test_intake_invalid_email(client: TestClient, sample_intake_data: dict):
    intake_data = sample_intake_data.copy()
    intake_data["client_email"] = "not-an-email"

    response = client.post("/intake", json=intake_data)
    assert response.status_code == 422
