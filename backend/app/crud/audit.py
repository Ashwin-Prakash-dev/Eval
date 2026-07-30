from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def create(db: Session, user_id: int | None, action: str, entity_type: str, entity_id: int | None, details: dict) -> None:
    db.add(
        AuditLog(user_id=user_id, action=action, entity_type=entity_type, entity_id=entity_id, details=details)
    )
    db.commit()


def list_paginated(
    db: Session, page: int = 1, page_size: int = 50, entity_type: str | None = None
) -> tuple[list[AuditLog], int]:
    stmt = select(AuditLog)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    stmt = stmt.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    return list(db.scalars(stmt)), total
