from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import EvaluationStatus

_StatusType = SqlEnum(
    EvaluationStatus, values_callable=lambda enum_cls: [e.value for e in enum_cls], native_enum=False, length=16
)


class Evaluation(Base):
    """One judge's evaluation of one assigned submission."""

    __tablename__ = "evaluations"

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("assignments.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    judge_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    status: Mapped[EvaluationStatus] = mapped_column(
        _StatusType, nullable=False, default=EvaluationStatus.NOT_STARTED
    )
    weighted_overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    time_spent_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    assignment: Mapped["Assignment"] = relationship(back_populates="evaluation")
    judge: Mapped["User"] = relationship(back_populates="evaluations", foreign_keys=[judge_id])
    scores: Mapped[list["EvaluationScore"]] = relationship(back_populates="evaluation", cascade="all, delete-orphan")
    comment: Mapped["Comment | None"] = relationship(
        back_populates="evaluation", cascade="all, delete-orphan", uselist=False
    )


class EvaluationScore(Base):
    """A single criterion's score within one evaluation."""

    __tablename__ = "evaluation_scores"
    __table_args__ = (UniqueConstraint("evaluation_id", "criterion_id", name="uq_score_evaluation_criterion"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    evaluation_id: Mapped[int] = mapped_column(ForeignKey("evaluations.id", ondelete="CASCADE"), nullable=False)
    criterion_id: Mapped[int] = mapped_column(
        ForeignKey("evaluation_criteria.id", ondelete="CASCADE"), nullable=False
    )
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    evaluation: Mapped["Evaluation"] = relationship(back_populates="scores")
    criterion: Mapped["EvaluationCriterion"] = relationship(back_populates="scores")


class Comment(Base):
    """Overall qualitative remark a judge leaves on an evaluation (distinct from per-criterion comments)."""

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    evaluation_id: Mapped[int] = mapped_column(
        ForeignKey("evaluations.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    evaluation: Mapped["Evaluation"] = relationship(back_populates="comment")


class SubmissionScore(Base):
    """Materialized aggregate score for a submission, recomputed whenever a linked evaluation changes."""

    __tablename__ = "submission_scores"

    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), primary_key=True
    )
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    criterion_means: Mapped[dict] = mapped_column(__import__("sqlalchemy").JSON, default=dict, nullable=False)
    highest_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    lowest_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    std_dev: Mapped[float | None] = mapped_column(Float, nullable=True)
    reviews_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_flagged: Mapped[bool] = mapped_column(default=False, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    submission: Mapped["Submission"] = relationship(back_populates="score_summary")
