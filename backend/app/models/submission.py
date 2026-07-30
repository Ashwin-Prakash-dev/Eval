from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import VideoType

_VideoTypeType = SqlEnum(VideoType, values_callable=lambda enum_cls: [e.value for e in enum_cls], native_enum=False, length=16)


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_title: Mapped[str] = mapped_column(String(255), nullable=False)
    team_identifier: Mapped[str] = mapped_column(String(120), nullable=False)
    short_description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    additional_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    problem_statement_id: Mapped[int | None] = mapped_column(
        ForeignKey("problem_statements.id", ondelete="SET NULL"), nullable=True
    )

    ppt_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pdf_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    video_type: Mapped[VideoType] = mapped_column(_VideoTypeType, nullable=False, default=VideoType.YOUTUBE)
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    video_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    problem_statement: Mapped["ProblemStatement | None"] = relationship(back_populates="submissions")
    assignments: Mapped[list["Assignment"]] = relationship(back_populates="submission", cascade="all, delete-orphan")
    score_summary: Mapped["SubmissionScore | None"] = relationship(
        back_populates="submission", cascade="all, delete-orphan", uselist=False
    )
