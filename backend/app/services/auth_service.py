"""
Authentication service for user login and token management
"""
from sqlalchemy.orm import Session
from typing import Optional
from datetime import timedelta

from app.models.user import User
from app.schemas.auth import LoginResponse
from app.utils.security import verify_password, create_access_token
from app.config import settings


class AuthService:
    """Service for handling authentication operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """
        Authenticate a user with email and password
        
        Args:
            email: User's email address
            password: Plain text password
            
        Returns:
            User object if authentication successful, None otherwise
        """
        user = self.db.query(User).filter(User.email == email).first()
        
        if not user:
            return None
        
        if not verify_password(password, user.hashed_password):
            return None
        
        if not user.is_active:
            return None
        
        return user
    
    def create_user_token(self, user: User) -> LoginResponse:
        """
        Create access token for authenticated user
        
        Args:
            user: Authenticated user object
            
        Returns:
            LoginResponse with token and user information
        """
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        
        access_token = create_access_token(
            data={
                "sub": user.email,
                "user_id": str(user.id),
                "role": user.role
            },
            expires_delta=access_token_expires
        )
        
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user_id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            role=user.role
        )
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email address"""
        return self.db.query(User).filter(User.email == email).first()
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()
