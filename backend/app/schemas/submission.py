from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import VideoType


class SubmissionCreate(BaseModel):
    project_title: str = Field(min_length=1, max_length=255)
    team_identifier: str = Field(min_length=1, max_length=120)
    problem_statement_id: int | None = None
    short_description: str = ""
    additional_notes: str | None = None
    video_type: VideoType = VideoType.YOUTUBE
    video_url: str | None = None

    @model_validator(mode="after")
    def validate_video(self) -> "SubmissionCreate":
        if self.video_type in (VideoType.YOUTUBE, VideoType.VIMEO) and not self.video_url:
            raise ValueError("video_url is required when video_type is youtube or vimeo")
        return self


class SubmissionUpdate(BaseModel):
    project_title: str | None = Field(default=None, min_length=1, max_length=255)
    team_identifier: str | None = Field(default=None, min_length=1, max_length=120)
    problem_statement_id: int | None = None
    short_description: str | None = None
    additional_notes: str | None = None
    video_type: VideoType | None = None
    video_url: str | None = None


class ProblemStatementBrief(BaseModel):
    id: int
    code: str
    title: str

    model_config = {"from_attributes": True}


class SubmissionOut(BaseModel):
    """Full admin view - includes the team identifier."""

    id: int
    project_title: str
    team_identifier: str
    short_description: str
    additional_notes: str | None
    problem_statement: ProblemStatementBrief | None
    has_ppt: bool
    has_pdf: bool
    video_type: VideoType
    video_url: str | None
    has_video_file: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SubmissionJudgeOut(BaseModel):
    """Judge-facing view - the team identifier is never included."""

    id: int
    project_title: str
    short_description: str
    additional_notes: str | None
    problem_statement: ProblemStatementBrief | None
    has_ppt: bool
    has_pdf: bool
    video_type: VideoType
    video_url: str | None
    has_video_file: bool

    model_config = {"from_attributes": True}


class BulkImportRow(BaseModel):
    project_title: str
    team_identifier: str
    problem_statement_code: str | None = None
    short_description: str = ""
    additional_notes: str | None = None
    video_type: VideoType = VideoType.YOUTUBE
    video_url: str | None = None


class BulkImportResult(BaseModel):
    created: int
    failed: int
    errors: list[str]
