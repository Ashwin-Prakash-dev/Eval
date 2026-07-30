from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (UniqueConstraint("submission_id", "judge_id", name="uq_assignment_submission_judge"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    judge_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    source: Mapped[str] = mapped_column(String(16), default="auto", nullable=False)  # "auto" | "manual"
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    submission: Mapped["Submission"] = relationship(back_populates="assignments")
    judge: Mapped["User"] = relationship(back_populates="assignments", foreign_keys=[judge_id])
    evaluation: Mapped["Evaluation | None"] = relationship(
        back_populates="assignment", cascade="all, delete-orphan", uselist=False
    )


class ConflictExclusion(Base):
    """Admin-managed pairs that the assignment generator must never assign together."""

    __tablename__ = "conflict_exclusions"
    __table_args__ = (UniqueConstraint("submission_id", "judge_id", name="uq_conflict_submission_judge"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    judge_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
