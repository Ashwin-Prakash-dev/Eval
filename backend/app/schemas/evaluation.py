from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import EvaluationStatus
from app.schemas.submission import SubmissionJudgeOut


class ScoreEntry(BaseModel):
    criterion_id: int
    score: float | None = Field(default=None, ge=1, le=10)
    comment: str | None = None


class EvaluationAutosaveRequest(BaseModel):
    """Partial payload sent on every autosave tick from the judge's evaluation form."""

    scores: list[ScoreEntry] = Field(default_factory=list)
    overall_comment: str | None = None
    time_spent_delta_seconds: int = Field(default=0, ge=0)
    mark_complete: bool | None = None


class CriterionBrief(BaseModel):
    id: int
    name: str
    description: str
    weight: float
    order_index: int

    model_config = {"from_attributes": True}


class ScoreOut(BaseModel):
    criterion_id: int
    score: float | None
    comment: str | None

    model_config = {"from_attributes": True}


class EvaluationOut(BaseModel):
    id: int
    assignment_id: int
    submission_id: int
    status: EvaluationStatus
    weighted_overall_score: float | None
    time_spent_seconds: int
    started_at: datetime | None
    completed_at: datetime | None
    updated_at: datetime
    overall_comment: str | None
    scores: list[ScoreOut]

    model_config = {"from_attributes": True}


class EvaluationJudgeBrief(BaseModel):
    id: int
    username: str
    full_name: str | None

    model_config = {"from_attributes": True}


class EvaluationAdminOut(EvaluationOut):
    judge: EvaluationJudgeBrief


class EvaluationDetailOut(BaseModel):
    evaluation: EvaluationOut
    submission: SubmissionJudgeOut
    criteria: list[CriterionBrief]


class JudgeProgressOut(BaseModel):
    total_assigned: int
    completed: int
    in_progress: int
    not_started: int
    percent_complete: float
