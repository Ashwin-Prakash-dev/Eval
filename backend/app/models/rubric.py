from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Rubric(Base):
    __tablename__ = "rubrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    disagreement_threshold: Mapped[float] = mapped_column(Float, default=1.5, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    criteria: Mapped[list["EvaluationCriterion"]] = relationship(
        back_populates="rubric", cascade="all, delete-orphan", order_by="EvaluationCriterion.order_index"
    )


class EvaluationCriterion(Base):
    __tablename__ = "evaluation_criteria"

    id: Mapped[int] = mapped_column(primary_key=True)
    rubric_id: Mapped[int] = mapped_column(ForeignKey("rubrics.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    rubric: Mapped["Rubric"] = relationship(back_populates="criteria")
    scores: Mapped[list["EvaluationScore"]] = relationship(back_populates="criterion", cascade="all, delete-orphan")
