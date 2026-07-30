from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import UserRole

_RoleType = SqlEnum(UserRole, values_callable=lambda enum_cls: [e.value for e in enum_cls], native_enum=False, length=16)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    role: Mapped[UserRole] = mapped_column(_RoleType, nullable=False, default=UserRole.JUDGE)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="judge", foreign_keys="Assignment.judge_id", cascade="all, delete-orphan"
    )
    evaluations: Mapped[list["Evaluation"]] = relationship(back_populates="judge", cascade="all, delete-orphan")
