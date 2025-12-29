"""
Transaction model for financial transactions and fraud detection
"""
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Numeric, Text, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


class TransactionType(str, enum.Enum):
    """Types of financial transactions"""
    VIREMENT = "virement"
    PRELEVEMENT = "prelevement"
    CARTE = "carte"
    RETRAIT = "retrait"
    DEPOT = "depot"


class TransactionChannel(str, enum.Enum):
    """Transaction channels"""
    WEB = "web"
    MOBILE = "mobile"
    AGENCE = "agence"
    ATM = "atm"
    API = "api"


class TransactionStatus(str, enum.Enum):
    """Transaction review status"""
    PENDING = "pending"
    ANALYZING = "analyzing"
    ANALYZED = "analyzed"
    REVIEWED = "reviewed"
    CONFIRMED_FRAUD = "confirmed_fraud"
    CLEARED = "cleared"
    UNDER_INVESTIGATION = "under_investigation"
    PENDING_CALL = "pending_call"
    BLOCKED = "blocked"


class Transaction(Base):
    """Financial transaction model with fraud detection fields"""
    
    __tablename__ = "transactions"
    
    # Primary fields
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_ref = Column(String(50), unique=True, nullable=False, index=True)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="EUR")
    
    # Account information
    sender_account = Column(String(34), nullable=False)
    receiver_account = Column(String(34), nullable=False)
    sender_name = Column(String(255))
    receiver_name = Column(String(255))
    
    # Transaction details
    transaction_type = Column(String(50), nullable=False)
    channel = Column(String(50), default=TransactionChannel.WEB.value)
    country_origin = Column(String(3))
    country_destination = Column(String(3))
    ip_address = Column(String(45))
    device_id = Column(String(255))
    merchant_category = Column(String(100))
    description = Column(Text)
    transaction_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Fraud detection fields
    fraud_score = Column(Integer)
    is_suspicious = Column(Boolean, default=False)
    is_confirmed_fraud = Column(Boolean, default=False)
    is_false_positive = Column(Boolean, default=False)
    analysis_date = Column(DateTime(timezone=True))
    ai_explanation = Column(Text)
    
    # Review fields
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    reviewed_at = Column(DateTime(timezone=True))
    review_notes = Column(Text)
    status = Column(String(50), default=TransactionStatus.PENDING.value)
    
    # === NOUVELLES ACTIONS FRAUDE ===
    
    # Blocage
    is_blocked = Column(Boolean, default=False)
    blocked_at = Column(DateTime(timezone=True))
    blocked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Ticket fraude
    ticket_number = Column(String(50))
    ticket_created_at = Column(DateTime(timezone=True))
    ticket_created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Appel client
    call_requested = Column(Boolean, default=False)
    call_requested_at = Column(DateTime(timezone=True))
    call_requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    call_completed = Column(Boolean, default=False)
    call_completed_at = Column(DateTime(timezone=True))
    call_completed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Validation (fausse alerte)
    cleared_at = Column(DateTime(timezone=True))
    cleared_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Relationships
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    
    def __repr__(self):
        return f"<Transaction {self.transaction_ref} - {self.amount} {self.currency}>"
    
    @property
    def risk_level(self) -> str:
        """Get risk level based on fraud score"""
        if self.fraud_score is None:
            return "unknown"
        if self.fraud_score >= 85:
            return "critical"
        if self.fraud_score >= 70:
            return "high"
        if self.fraud_score >= 50:
            return "medium"
        return "low"
    
    @property
    def action_status(self) -> dict:
        """Get current action status"""
        return {
            "is_blocked": self.is_blocked,
            "has_ticket": self.ticket_number is not None,
            "ticket_number": self.ticket_number,
            "call_requested": self.call_requested,
            "call_completed": self.call_completed,
            "is_cleared": self.status == TransactionStatus.CLEARED.value
        }
