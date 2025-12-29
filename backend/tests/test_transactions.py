"""
Tests for transaction endpoints
"""
import pytest
from fastapi import status
from datetime import datetime
from decimal import Decimal


class TestTransactionEndpoints:
    """Test transaction endpoints"""
    
    def get_sample_transaction(self):
        """Return sample transaction data"""
        return {
            "amount": 1500.00,
            "currency": "EUR",
            "sender_account": "FR7630001007941234567890185",
            "receiver_account": "FR7630004000031234567890143",
            "sender_name": "Jean Dupont",
            "receiver_name": "Marie Martin",
            "transaction_type": "virement",
            "channel": "web",
            "country_origin": "FRA",
            "country_destination": "FRA",
            "description": "Test transaction",
            "transaction_date": datetime.now().isoformat()
        }
    
    def test_create_transaction(self, client, auth_headers):
        """Test creating a new transaction"""
        response = client.post(
            "/transactions",
            json=self.get_sample_transaction(),
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "id" in data
        assert "transaction_ref" in data
        assert data["amount"] == "1500.00"
        assert data["status"] == "pending"
    
    def test_create_transaction_unauthorized(self, client):
        """Test creating transaction without auth"""
        response = client.post(
            "/transactions",
            json=self.get_sample_transaction()
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_list_transactions(self, client, auth_headers):
        """Test listing transactions"""
        # Create a transaction first
        client.post(
            "/transactions",
            json=self.get_sample_transaction(),
            headers=auth_headers
        )
        
        response = client.get("/transactions", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert data["total"] >= 1
    
    def test_list_transactions_with_filters(self, client, auth_headers):
        """Test listing transactions with filters"""
        # Create a transaction
        client.post(
            "/transactions",
            json=self.get_sample_transaction(),
            headers=auth_headers
        )
        
        response = client.get(
            "/transactions?status=pending&min_amount=1000",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
    
    def test_get_transaction_by_id(self, client, auth_headers):
        """Test getting a specific transaction"""
        # Create a transaction
        create_response = client.post(
            "/transactions",
            json=self.get_sample_transaction(),
            headers=auth_headers
        )
        transaction_id = create_response.json()["id"]
        
        response = client.get(
            f"/transactions/{transaction_id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == transaction_id
    
    def test_get_nonexistent_transaction(self, client, auth_headers):
        """Test getting a non-existent transaction"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(
            f"/transactions/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_analyze_transaction(self, client, auth_headers):
        """Test analyzing a transaction for fraud"""
        # Create a transaction
        create_response = client.post(
            "/transactions",
            json=self.get_sample_transaction(),
            headers=auth_headers
        )
        transaction_id = create_response.json()["id"]
        
        response = client.post(
            f"/transactions/{transaction_id}/analyze",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "fraud_score" in data
        assert "is_suspicious" in data
        assert "ai_explanation" in data
        assert 0 <= data["fraud_score"] <= 100
    
    def test_analyze_suspicious_transaction(self, client, auth_headers):
        """Test analyzing a suspicious transaction (high amount, night)"""
        suspicious_transaction = self.get_sample_transaction()
        suspicious_transaction["amount"] = 25000.00
        suspicious_transaction["country_destination"] = "RUS"
        suspicious_transaction["transaction_date"] = datetime.now().replace(hour=3).isoformat()
        
        create_response = client.post(
            "/transactions",
            json=suspicious_transaction,
            headers=auth_headers
        )
        transaction_id = create_response.json()["id"]
        
        response = client.post(
            f"/transactions/{transaction_id}/analyze",
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should have a higher fraud score due to suspicious indicators
        assert data["fraud_score"] > 50
    
    def test_review_transaction(self, client, auth_headers):
        """Test reviewing a transaction"""
        # Create and analyze a transaction
        create_response = client.post(
            "/transactions",
            json=self.get_sample_transaction(),
            headers=auth_headers
        )
        transaction_id = create_response.json()["id"]
        
        client.post(
            f"/transactions/{transaction_id}/analyze",
            headers=auth_headers
        )
        
        # Review the transaction
        response = client.post(
            f"/transactions/{transaction_id}/review",
            json={
                "is_confirmed_fraud": False,
                "review_notes": "Transaction verified and cleared"
            },
            headers=auth_headers
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "cleared"
    
    def test_get_stats(self, client, auth_headers):
        """Test getting dashboard statistics"""
        response = client.get("/transactions/stats", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "total_transactions" in data
        assert "suspicious_count" in data
        assert "confirmed_fraud_count" in data
    
    def test_get_daily_stats(self, client, auth_headers):
        """Test getting daily statistics"""
        response = client.get("/transactions/daily-stats?days=7", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    def test_delete_transaction_admin_only(self, client, auth_headers, admin_auth_headers):
        """Test that only admins can delete transactions"""
        # Create a transaction
        create_response = client.post(
            "/transactions",
            json=self.get_sample_transaction(),
            headers=auth_headers
        )
        transaction_id = create_response.json()["id"]
        
        # Try to delete as regular user (should fail)
        response = client.delete(
            f"/transactions/{transaction_id}",
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        
        # Delete as admin (should succeed)
        response = client.delete(
            f"/transactions/{transaction_id}",
            headers=admin_auth_headers
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT


class TestHealthEndpoints:
    """Test health check endpoints"""
    
    def test_health_check(self, client):
        """Test health endpoint"""
        response = client.get("/health")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "status" in data
        assert "services" in data
    
    def test_root_endpoint(self, client):
        """Test root endpoint"""
        response = client.get("/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "name" in data
        assert "version" in data
