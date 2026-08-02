from datetime import datetime

from pydantic import BaseModel, Field


class GenerateAssignmentsRequest(BaseModel):
    judges_per_submission: int = Field(gt=0, le=50)
    reset_existing: bool = Field(
        default=False, description="If true, delete all existing assignments before generating new ones."
    )


class GenerateAssignmentsResult(BaseModel):
    assignments_created: int
    submissions_covered: int
    judges_used: int
    min_load: int
    max_load: int
    warnings: list[str]


class ManualAssignmentCreate(BaseModel):
    submission_id: int
    judge_id: int


class AssignmentSubmissionBrief(BaseModel):
    id: int
    project_title: str
    team_identifier: str

    model_config = {"from_attributes": True}


class AssignmentJudgeBrief(BaseModel):
    id: int
    email: str
    full_name: str | None

    model_config = {"from_attributes": True}


class AssignmentOut(BaseModel):
    id: int
    submission: AssignmentSubmissionBrief
    judge: AssignmentJudgeBrief
    source: str
    assigned_at: datetime
    evaluation_status: str

    model_config = {"from_attributes": True}


class ConflictExclusionCreate(BaseModel):
    submission_id: int
    judge_id: int
    reason: str | None = Field(default=None, max_length=255)


class ConflictExclusionOut(BaseModel):
    id: int
    submission_id: int
    judge_id: int
    reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
