from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import UserRole


class JudgeCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=6, max_length=128)
    full_name: str | None = Field(default=None, max_length=120)


class JudgeUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None


class PasswordResetRequest(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)


class JudgeOut(BaseModel):
    id: int
    username: str
    full_name: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login: datetime | None

    model_config = {"from_attributes": True}


class JudgeStats(BaseModel):
    judge: JudgeOut
    reviews_assigned: int
    reviews_completed: int
    reviews_pending: int
    average_score_given: float | None
    std_dev_given: float | None
    average_review_time_seconds: float | None
    is_harsh: bool
    is_lenient: bool
    is_high_variance: bool
