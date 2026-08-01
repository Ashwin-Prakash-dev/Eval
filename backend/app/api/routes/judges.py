from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.crud import access as access_crud
from app.crud import audit as audit_crud
from app.crud import user as user_crud
from app.models.access import AllowedEmail
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import (
    AllowedEmailBulkCreate,
    AllowedEmailBulkResult,
    AllowedEmailCreate,
    AllowedEmailOut,
    AllowedEmailUpdate,
    JudgeOut,
    JudgeStats,
    JudgeUpdate,
)
from app.services import scoring_service

router = APIRouter(prefix="/judges", tags=["judges"])


def _allowed_out(entry: AllowedEmail, user: User | None) -> AllowedEmailOut:
    return AllowedEmailOut(
        id=entry.id,
        email=entry.email,
        role=entry.role,
        full_name=entry.full_name,
        note=entry.note,
        is_active=entry.is_active,
        created_at=entry.created_at,
        user=JudgeOut.model_validate(user) if user else None,
    )


@router.get("", response_model=list[JudgeOut])
def list_judges(
    search: str | None = None, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> list[JudgeOut]:
    """Judges who have signed in at least once. For the full approved list including
    people who have not signed in yet, use /judges/allowed."""
    return [JudgeOut.model_validate(j) for j in user_crud.list_judges(db, search)]


@router.get("/allowed", response_model=list[AllowedEmailOut])
def list_allowed_emails(
    search: str | None = None, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> list[AllowedEmailOut]:
    entries = access_crud.list_allowed(db, search=search)
    users = access_crud.users_by_email(db, [e.email for e in entries])
    return [_allowed_out(entry, users.get(entry.email)) for entry in entries]


@router.post("/allowed", response_model=AllowedEmailOut, status_code=status.HTTP_201_CREATED)
def create_allowed_email(
    payload: AllowedEmailCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> AllowedEmailOut:
    if access_crud.get_allowed_by_email(db, payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="That email is already on the approved list")
    entry = access_crud.create_allowed(db, payload, admin.id)
    audit_crud.create(db, admin.id, "approve_email", "allowed_email", entry.id, {"email": entry.email, "role": entry.role.value})
    return _allowed_out(entry, user_crud.get_by_email(db, entry.email))


@router.post("/allowed/bulk", response_model=AllowedEmailBulkResult)
def bulk_create_allowed_emails(
    payload: AllowedEmailBulkCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> AllowedEmailBulkResult:
    created = 0
    skipped: list[str] = []
    for raw_email in payload.emails:
        email = user_crud.normalize_email(str(raw_email))
        if access_crud.get_allowed_by_email(db, email):
            skipped.append(email)
            continue
        access_crud.create_allowed(db, AllowedEmailCreate(email=email, role=payload.role), admin.id)
        created += 1

    audit_crud.create(db, admin.id, "approve_email_bulk", "allowed_email", None, {"created": created, "skipped": len(skipped)})
    return AllowedEmailBulkResult(created=created, skipped=len(skipped), skipped_emails=skipped)


@router.patch("/allowed/{allowed_id}", response_model=AllowedEmailOut)
def update_allowed_email(
    allowed_id: int, payload: AllowedEmailUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> AllowedEmailOut:
    entry = access_crud.get_allowed(db, allowed_id)
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Approved email not found")
    entry = access_crud.update_allowed(db, entry, payload)
    audit_crud.create(db, admin.id, "update", "allowed_email", entry.id, payload.model_dump(exclude_unset=True))

    user = user_crud.get_by_email(db, entry.email)
    if user and payload.is_active is not None:
        user_crud.update_user(db, user, is_active=payload.is_active)
    return _allowed_out(entry, user)


@router.delete("/allowed/{allowed_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_allowed_email(allowed_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> None:
    entry = access_crud.get_allowed(db, allowed_id)
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Approved email not found")
    if entry.email == admin.email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="You cannot remove your own access")

    user = user_crud.get_by_email(db, entry.email)
    if user:
        user_crud.update_user(db, user, is_active=False)

    audit_crud.create(db, admin.id, "revoke_email", "allowed_email", entry.id, {"email": entry.email})
    access_crud.delete_allowed(db, entry)


@router.get("/stats", response_model=list[JudgeStats])
def judge_stats(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[JudgeStats]:
    return scoring_service.compute_judge_stats(db)


@router.patch("/{judge_id}", response_model=JudgeOut)
def update_judge(
    judge_id: int, payload: JudgeUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> JudgeOut:
    judge = user_crud.get_by_id(db, judge_id)
    if not judge or judge.role != UserRole.JUDGE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Judge not found")
    judge = user_crud.update_user(db, judge, payload.full_name, payload.is_active)
    audit_crud.create(db, admin.id, "update", "judge", judge.id, payload.model_dump(exclude_unset=True))
    return JudgeOut.model_validate(judge)
