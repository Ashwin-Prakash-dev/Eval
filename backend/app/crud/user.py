from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import UserRole
from app.models.user import User


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalize_email(email)))


def create_user(db: Session, email: str, role: UserRole, full_name: str | None = None) -> User:
    user = User(email=normalize_email(email), role=role, full_name=full_name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_judges(db: Session, search: str | None = None) -> list[User]:
    stmt = select(User).where(User.role == UserRole.JUDGE)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(User.email.ilike(pattern) | User.full_name.ilike(pattern))
    return list(db.scalars(stmt.order_by(User.created_at.desc())))


def update_user(db: Session, user: User, full_name: str | None = None, is_active: bool | None = None) -> User:
    if full_name is not None:
        user.full_name = full_name
    if is_active is not None:
        user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user
