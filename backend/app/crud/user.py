from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username))


def create_user(db: Session, username: str, password: str, role: UserRole, full_name: str | None = None) -> User:
    user = User(username=username, password_hash=hash_password(password), role=role, full_name=full_name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_judges(db: Session, search: str | None = None) -> list[User]:
    stmt = select(User).where(User.role == UserRole.JUDGE)
    if search:
        stmt = stmt.where(User.username.ilike(f"%{search}%"))
    return list(db.scalars(stmt.order_by(User.created_at.desc())))


def update_user(db: Session, user: User, full_name: str | None = None, is_active: bool | None = None) -> User:
    if full_name is not None:
        user.full_name = full_name
    if is_active is not None:
        user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user


def reset_password(db: Session, user: User, new_password: str) -> User:
    user.password_hash = hash_password(new_password)
    db.commit()
    db.refresh(user)
    return user
