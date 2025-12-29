"""
Pydantic schemas for users
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr
    full_name: str


class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: str
    role: str = "analyst"
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "newuser@bpce.fr",
                "full_name": "Jean Dupont",
                "password": "SecurePass123!",
                "role": "analyst"
            }
        }


class UserUpdate(BaseModel):
    """Schema for updating a user"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """User response schema"""
    id: UUID
    role: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserInDB(UserResponse):
    """User schema with hashed password (internal use)"""
    hashed_password: str
