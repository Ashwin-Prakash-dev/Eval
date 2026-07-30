from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.crud import audit as audit_crud
from app.crud import user as user_crud
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import JudgeCreate, JudgeOut, JudgeStats, JudgeUpdate, PasswordResetRequest
from app.services import scoring_service

router = APIRouter(prefix="/judges", tags=["judges"])


@router.get("", response_model=list[JudgeOut])
def list_judges(
    search: str | None = None, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> list[JudgeOut]:
    return [JudgeOut.model_validate(j) for j in user_crud.list_judges(db, search)]


@router.get("/stats", response_model=list[JudgeStats])
def judge_stats(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[JudgeStats]:
    return scoring_service.compute_judge_stats(db)


@router.post("", response_model=JudgeOut, status_code=status.HTTP_201_CREATED)
def create_judge(payload: JudgeCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> JudgeOut:
    if user_crud.get_by_username(db, payload.username):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Username already exists")
    judge = user_crud.create_user(db, payload.username, payload.password, UserRole.JUDGE, payload.full_name)
    audit_crud.create(db, admin.id, "create", "judge", judge.id, {"username": judge.username})
    return JudgeOut.model_validate(judge)


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


@router.post("/{judge_id}/deactivate", response_model=JudgeOut)
def deactivate_judge(judge_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> JudgeOut:
    judge = user_crud.get_by_id(db, judge_id)
    if not judge or judge.role != UserRole.JUDGE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Judge not found")
    judge = user_crud.update_user(db, judge, is_active=False)
    audit_crud.create(db, admin.id, "deactivate", "judge", judge.id, {})
    return JudgeOut.model_validate(judge)


@router.post("/{judge_id}/reactivate", response_model=JudgeOut)
def reactivate_judge(judge_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> JudgeOut:
    judge = user_crud.get_by_id(db, judge_id)
    if not judge or judge.role != UserRole.JUDGE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Judge not found")
    judge = user_crud.update_user(db, judge, is_active=True)
    audit_crud.create(db, admin.id, "reactivate", "judge", judge.id, {})
    return JudgeOut.model_validate(judge)


@router.post("/{judge_id}/reset-password", response_model=JudgeOut)
def reset_password(
    judge_id: int, payload: PasswordResetRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> JudgeOut:
    judge = user_crud.get_by_id(db, judge_id)
    if not judge or judge.role != UserRole.JUDGE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Judge not found")
    judge = user_crud.reset_password(db, judge, payload.new_password)
    audit_crud.create(db, admin.id, "reset_password", "judge", judge.id, {})
    return JudgeOut.model_validate(judge)
