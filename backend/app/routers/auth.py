"""
Authentication router
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import LoginRequest, LoginResponse
from app.schemas.user import UserResponse, UserCreate
from app.services.auth_service import AuthService
from app.utils.dependencies import get_current_user
from app.utils.security import get_password_hash
from app.models.user import User
from app.middleware.audit import AuditLogger, get_client_ip, get_user_agent

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Register a new user account
    
    - **email**: User's email address
    - **password**: User's password (min 8 characters)
    - **full_name**: User's full name
    - **role**: User role (analyst or admin)
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un compte avec cet email existe déjà"
        )
    
    # Create new user
    new_user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Log registration
    AuditLogger.log_action(
        db=db,
        user_id=new_user.id,
        action="register",
        resource_type="user",
        resource_id=new_user.id,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request)
    )
    
    return new_user


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return JWT token
    
    - **email**: User's email address
    - **password**: User's password
    
    Returns access token and user information
    """
    auth_service = AuthService(db)
    user = auth_service.authenticate_user(login_data.email, login_data.password)
    
    if not user:
        # Log failed login attempt
        AuditLogger.log_action(
            db=db,
            user_id=None,
            action="login_failed",
            resource_type="authentication",
            details={"email": login_data.email},
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request)
        )
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Log successful login
    AuditLogger.log_action(
        db=db,
        user_id=user.id,
        action="login_success",
        resource_type="authentication",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request)
    )
    
    return auth_service.create_user_token(user)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get current authenticated user information
    
    Requires valid JWT token in Authorization header
    """
    return current_user


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Log out current user
    
    Note: JWT tokens are stateless, so this endpoint just logs the action.
    Client should discard the token.
    """
    AuditLogger.log_action(
        db=db,
        user_id=current_user.id,
        action="logout",
        resource_type="authentication",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request)
    )
    
    return {"message": "Déconnexion réussie"}


@router.post("/refresh")
async def refresh_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Refresh access token
    
    Requires valid (non-expired) JWT token
    """
    auth_service = AuthService(db)
    return auth_service.create_user_token(current_user)
