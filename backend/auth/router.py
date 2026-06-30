"""Authentication endpoints — login, register, and current user info."""

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.db.sqlite_setup import User as UserModel, get_session
from backend.core.logging_config import get_logger

from .dependencies import get_current_user
from .jwt_handler import create_access_token
from .schemas import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])
log = get_logger("auth")


def _hash_password(password: str) -> str:
    """Hash a password with bcrypt salt rounds."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def _build_token_response(user: UserModel) -> TokenResponse:
    """Build a TokenResponse from a user model instance."""
    token = create_access_token(user.id, user.role)
    return TokenResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        },
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_session)):
    """Authenticate with email + password and receive a JWT."""
    try:
        user = db.query(UserModel).filter(UserModel.email == req.email).first()
        if not user or not _verify_password(req.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled",
            )
        return _build_token_response(user)
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Login error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred",
        )


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_session)):
    """Register a new user account and receive a JWT."""
    try:
        existing = (
            db.query(UserModel).filter(UserModel.email == req.email).first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        user = UserModel(
            email=req.email,
            password_hash=_hash_password(req.password),
            full_name=req.full_name,
            role="user",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return _build_token_response(user)
    except HTTPException:
        raise
    except Exception as e:
        log.exception("Registration error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred",
        )


@router.get("/me")
def get_me(current_user: UserModel = Depends(get_current_user)):
    """Return the currently authenticated user's details."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }
