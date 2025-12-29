"""
Audit logging middleware
"""
from sqlalchemy.orm import Session
from fastapi import Request
from uuid import UUID
from typing import Optional, Any
import json

from app.models.audit_log import AuditLog


def get_client_ip(request: Request) -> str:
    """Extract client IP from request"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_user_agent(request: Request) -> Optional[str]:
    """Extract user agent from request"""
    return request.headers.get("User-Agent")


def convert_to_serializable(obj: Any) -> Any:
    """Convert numpy types and other non-serializable types to Python natives"""
    if obj is None:
        return None
    
    # Handle numpy types
    type_name = type(obj).__name__
    if type_name in ('bool_', 'bool8'):
        return bool(obj)
    if type_name in ('int_', 'int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64'):
        return int(obj)
    if type_name in ('float_', 'float16', 'float32', 'float64'):
        return float(obj)
    if type_name == 'ndarray':
        return obj.tolist()
    
    # Handle dict recursively
    if isinstance(obj, dict):
        return {k: convert_to_serializable(v) for k, v in obj.items()}
    
    # Handle list recursively
    if isinstance(obj, list):
        return [convert_to_serializable(item) for item in obj]
    
    return obj


class AuditLogger:
    """Centralized audit logging"""
    
    @staticmethod
    def log_action(
        db: Session,
        user_id: Optional[UUID],
        action: str,
        resource_type: str = None,
        resource_id: UUID = None,
        details: dict = None,
        ip_address: str = None,
        user_agent: str = None
    ) -> AuditLog:
        """Log an action to the audit trail"""
        # Convert details to JSON-serializable format
        safe_details = convert_to_serializable(details) if details else None
        
        log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=safe_details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        db.add(log)
        db.commit()
        db.refresh(log)
        
        return log
    
    @staticmethod
    def log_transaction_analysis(
        db: Session,
        user_id: UUID,
        transaction_id: UUID,
        fraud_score: int,
        is_suspicious: bool,
        ip_address: str = None
    ) -> AuditLog:
        """Log a transaction analysis"""
        return AuditLogger.log_action(
            db=db,
            user_id=user_id,
            action="analyze_transaction",
            resource_type="transaction",
            resource_id=transaction_id,
            details={
                "fraud_score": int(fraud_score),
                "is_suspicious": bool(is_suspicious)
            },
            ip_address=ip_address
        )
    
    @staticmethod
    def log_transaction_review(
        db: Session,
        user_id: UUID,
        transaction_id: UUID,
        decision: str,
        notes: str = None,
        ip_address: str = None
    ) -> AuditLog:
        """Log a transaction review decision"""
        return AuditLogger.log_action(
            db=db,
            user_id=user_id,
            action="review_transaction",
            resource_type="transaction",
            resource_id=transaction_id,
            details={
                "decision": decision,
                "notes": notes
            },
            ip_address=ip_address
        )
