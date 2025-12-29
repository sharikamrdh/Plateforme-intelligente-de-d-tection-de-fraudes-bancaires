"""
Pydantic schemas for transactions
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class TransactionBase(BaseModel):
    """Base transaction schema"""
    amount: Decimal = Field(..., gt=0, description="Transaction amount")
    currency: str = Field(default="EUR", max_length=3)
    sender_account: str = Field(..., max_length=34)
    receiver_account: str = Field(..., max_length=34)
    sender_name: Optional[str] = None
    receiver_name: Optional[str] = None
    transaction_type: str = Field(..., description="Type: virement, prelevement, carte, retrait, depot")
    channel: str = Field(default="web", description="Channel: web, mobile, agence, atm, api")
    country_origin: Optional[str] = Field(None, max_length=3)
    country_destination: Optional[str] = Field(None, max_length=3)
    ip_address: Optional[str] = None
    device_id: Optional[str] = None
    merchant_category: Optional[str] = None
    description: Optional[str] = None
    transaction_date: datetime


class TransactionCreate(TransactionBase):
    """Schema for creating a new transaction"""
    
    class Config:
        json_schema_extra = {
            "example": {
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
                "ip_address": "192.168.1.100",
                "description": "Virement mensuel",
                "transaction_date": "2024-01-15T10:30:00Z"
            }
        }


class TransactionResponse(TransactionBase):
    """Transaction response schema"""
    id: UUID
    transaction_ref: str
    fraud_score: Optional[int] = None
    is_suspicious: bool = False
    is_confirmed_fraud: bool = False
    analysis_date: Optional[datetime] = None
    ai_explanation: Optional[str] = None
    status: str = "pending"
    created_at: datetime
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    
    class Config:
        from_attributes = True


class TransactionAnalysisRequest(BaseModel):
    """Request for transaction analysis"""
    force_reanalysis: bool = False


class TransactionAnalysisResponse(BaseModel):
    """Response from fraud analysis"""
    transaction_id: UUID
    transaction_ref: str
    fraud_score: int
    is_suspicious: bool
    risk_level: str
    ai_explanation: str
    analysis_date: datetime
    factors: List[str]


class TransactionListResponse(BaseModel):
    """Paginated list of transactions"""
    items: List[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TransactionStatsResponse(BaseModel):
    """Dashboard statistics"""
    total_transactions: int
    suspicious_count: int
    confirmed_fraud_count: int
    pending_review: int
    average_fraud_score: Optional[float]
    total_fraud_amount: Optional[Decimal]
    transactions_today: int
    high_risk_count: int


class DailyStatsResponse(BaseModel):
    """Daily statistics for charts"""
    date: str
    total: int
    suspicious: int
    fraud_amount: Decimal


class TransactionReviewRequest(BaseModel):
    """Request for reviewing a transaction"""
    is_confirmed_fraud: bool
    review_notes: Optional[str] = None
