"""
Pydantic schemas for authentication
"""
from pydantic import BaseModel, EmailStr
from typing import Optional


class Token(BaseModel):
    """JWT Token response"""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Data encoded in JWT token"""
    email: Optional[str] = None
    user_id: Optional[str] = None
    role: Optional[str] = None


class LoginRequest(BaseModel):
    """Login request body"""
    email: EmailStr
    password: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "analyst@bpce.fr",
                "password": "Admin123!"
            }
        }


class LoginResponse(BaseModel):
    """Login response with token and user info"""
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: str
    role: str
