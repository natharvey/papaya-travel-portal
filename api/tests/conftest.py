import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set env vars before importing app modules
os.environ["DATABASE_URL"] = "sqlite:///./test_papaya.db"
os.environ["JWT_SECRET"] = "test-secret-key"
os.environ["ADMIN_PASSWORD"] = "testpass"
os.environ["ANTHROPIC_API_KEY"] = "sk-ant-test"
os.environ["SEED_ON_STARTUP"] = "false"

from app.db import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite:///./test_papaya.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    # Clean up test db file
    if os.path.exists("./test_papaya.db"):
        os.remove("./test_papaya.db")


@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def sample_intake_data():
    return {
        "client_name": "Test User",
        "client_email": "testuser@example.com",
        "trip_title": "Bali Adventure",
        "origin_city": "Sydney",
        "start_date": "2025-06-01",
        "end_date": "2025-06-14",
        "budget_range": "3000-5000 AUD",
        "pace": "moderate",
        "travellers_count": 2,
        "interests": ["beach", "culture", "food"],
        "constraints": "",
        "accommodation_style": "mid-range hotel",
        "must_dos": "Tegallalang Rice Terraces",
        "must_avoid": "",
        "notes": "",
    }
