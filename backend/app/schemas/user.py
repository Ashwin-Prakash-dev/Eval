from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole


class AllowedEmailCreate(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.JUDGE
    full_name: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=255)


class AllowedEmailUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class AllowedEmailBulkCreate(BaseModel):
    emails: list[EmailStr] = Field(min_length=1, max_length=500)
    role: UserRole = UserRole.JUDGE


class AllowedEmailBulkResult(BaseModel):
    created: int
    skipped: int
    skipped_emails: list[str]


class JudgeUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None


class JudgeOut(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login: datetime | None

    model_config = {"from_attributes": True}


class AllowedEmailOut(BaseModel):
    id: int
    email: str
    role: UserRole
    full_name: str | None
    note: str | None
    is_active: bool
    created_at: datetime
    user: JudgeOut | None = None

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
