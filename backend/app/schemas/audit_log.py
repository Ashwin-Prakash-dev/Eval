from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: int
    user_id: int | None
    username: str | None
    action: str
    entity_type: str
    entity_id: int | None
    details: dict
    created_at: datetime

    model_config = {"from_attributes": True}
