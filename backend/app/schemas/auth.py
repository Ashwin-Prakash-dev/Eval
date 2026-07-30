from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import UserRole


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=6, max_length=128)
    full_name: str | None = Field(default=None, max_length=120)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login: datetime | None

    model_config = {"from_attributes": True}


TokenResponse.model_rebuild()
