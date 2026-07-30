from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.crud import user as user_crud
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest


def register_judge(db: Session, data: RegisterRequest) -> User:
    """Every self-registered account becomes a Judge; the admin account is seeded separately."""
    if user_crud.get_by_username(db, data.username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    return user_crud.create_user(db, data.username, data.password, UserRole.JUDGE, data.full_name)


def authenticate(db: Session, data: LoginRequest) -> tuple[User, str]:
    user = user_crud.get_by_username(db, data.username)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated")

    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.username, role=user.role.value)
    return user, token
