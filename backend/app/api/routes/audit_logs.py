import math

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.crud import audit as audit_crud
from app.models.user import User
from app.schemas.audit_log import AuditLogOut
from app.schemas.common import Page

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("", response_model=Page[AuditLogOut])
def list_audit_logs(
    page: int = 1,
    page_size: int = 50,
    entity_type: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Page[AuditLogOut]:
    items, total = audit_crud.list_paginated(db, page, page_size, entity_type)
    out = [
        AuditLogOut(
            id=log.id,
            user_id=log.user_id,
            username=log.user.username if log.user else None,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            details=log.details,
            created_at=log.created_at,
        )
        for log in items
    ]
    return Page(items=out, total=total, page=page, page_size=page_size, total_pages=max(math.ceil(total / page_size), 1))
