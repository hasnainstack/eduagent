"""Authentication endpoints — login, register, and current user info."""

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from backend.db.sqlite_setup import User as UserModel, get_session

from .dependencies import get_current_user
from .jwt_handler import create_access_token
from .schemas import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


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
    user = db.query(UserModel).filter(UserModel.email == req.email).first()
    if not user or not pwd_ctx.verify(req.password, user.password_hash):
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


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_session)):
    """Register a new user account and receive a JWT."""
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
        password_hash=pwd_ctx.hash(req.password),
        full_name=req.full_name,
        role="user",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _build_token_response(user)


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
