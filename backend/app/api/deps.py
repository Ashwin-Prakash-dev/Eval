from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.crud import user as user_crud
from app.models.enums import UserRole
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)


def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_error
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise credentials_error
    user = user_crud.get_by_username(db, payload["sub"])
    if not user or not user.is_active:
        raise credentials_error
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
    return current_user


def require_judge(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.JUDGE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Judge access required")
    return current_user
