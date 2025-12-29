"""
Tests for authentication endpoints
"""
import pytest
from fastapi import status


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_login_success(self, client, test_user):
        """Test successful login"""
        response = client.post(
            "/auth/login",
            json={
                "email": "test@bpce.fr",
                "password": "TestPass123!"
            }
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["email"] == "test@bpce.fr"
        assert data["role"] == "analyst"
    
    def test_login_wrong_password(self, client, test_user):
        """Test login with wrong password"""
        response = client.post(
            "/auth/login",
            json={
                "email": "test@bpce.fr",
                "password": "WrongPassword!"
            }
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "incorrect" in response.json()["detail"].lower()
    
    def test_login_nonexistent_user(self, client):
        """Test login with non-existent user"""
        response = client.post(
            "/auth/login",
            json={
                "email": "nonexistent@bpce.fr",
                "password": "SomePassword!"
            }
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_login_invalid_email(self, client):
        """Test login with invalid email format"""
        response = client.post(
            "/auth/login",
            json={
                "email": "not-an-email",
                "password": "SomePassword!"
            }
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_get_current_user(self, client, auth_headers):
        """Test getting current user info"""
        response = client.get("/auth/me", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == "test@bpce.fr"
        assert data["role"] == "analyst"
    
    def test_get_current_user_no_token(self, client):
        """Test accessing protected endpoint without token"""
        response = client.get("/auth/me")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_get_current_user_invalid_token(self, client):
        """Test accessing protected endpoint with invalid token"""
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_logout(self, client, auth_headers):
        """Test logout endpoint"""
        response = client.post("/auth/logout", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        assert "réussie" in response.json()["message"].lower()
    
    def test_refresh_token(self, client, auth_headers):
        """Test token refresh"""
        response = client.post("/auth/refresh", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
