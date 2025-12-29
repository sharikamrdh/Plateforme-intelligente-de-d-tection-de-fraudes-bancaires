"""
Pytest fixtures and configuration
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models.user import User
from app.utils.security import get_password_hash


# Test database URL (in-memory SQLite)
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test"""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database override"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user(db_session) -> User:
    """Create a test analyst user"""
    user = User(
        email="test@bpce.fr",
        hashed_password=get_password_hash("TestPass123!"),
        full_name="Test User",
        role="analyst"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def test_admin(db_session) -> User:
    """Create a test admin user"""
    user = User(
        email="admin.test@bpce.fr",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Admin Test User",
        role="admin"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_headers(client, test_user) -> dict:
    """Get authentication headers for a test user"""
    response = client.post(
        "/auth/login",
        json={
            "email": "test@bpce.fr",
            "password": "TestPass123!"
        }
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def admin_auth_headers(client, test_admin) -> dict:
    """Get authentication headers for admin user"""
    response = client.post(
        "/auth/login",
        json={
            "email": "admin.test@bpce.fr",
            "password": "AdminPass123!"
        }
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
