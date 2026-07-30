from datetime import datetime

from pydantic import BaseModel, Field


class ProblemStatementCreate(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    title: str = Field(min_length=1, max_length=255)
    description: str = ""


class ProblemStatementUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=32)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class ProblemStatementOut(BaseModel):
    id: int
    code: str
    title: str
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}
