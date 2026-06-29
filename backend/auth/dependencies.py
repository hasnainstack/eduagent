"""FastAPI dependency injection for protected routes."""

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from fastapi.security.http import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.db.sqlite_setup import User as UserModel, get_session

from .jwt_handler import decode_access_token

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_session),
) -> UserModel:
    """Extract and validate the current user from the Bearer token."""
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = db.query(UserModel).filter(UserModel.id == int(payload["sub"])).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    db: Session = Depends(get_session),
) -> Optional[UserModel]:
    """Return the current user if authenticated, or None if no token provided.

    Unlike get_current_user, this does NOT raise 401 — it returns None
    for unauthenticated requests. Useful for endpoints where auth is optional.
    """
    if credentials is None:
        return None
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        return None
    user = db.query(UserModel).filter(UserModel.id == int(payload["sub"])).first()
    if user is None or not user.is_active:
        return None
    return user


def require_admin(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    """Require the current user to be an admin."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
