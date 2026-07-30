from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.crud import audit as audit_crud
from app.crud import rubric as rubric_crud
from app.models.user import User
from app.schemas.rubric import RubricCreate, RubricOut, RubricUpdate

router = APIRouter(prefix="/rubrics", tags=["rubrics"])


@router.get("", response_model=list[RubricOut])
def list_rubrics(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[RubricOut]:
    return [RubricOut.model_validate(r) for r in rubric_crud.list_all(db)]


@router.get("/active", response_model=RubricOut)
def get_active_rubric(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> RubricOut:
    rubric = rubric_crud.get_active(db)
    if not rubric:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No active rubric has been configured yet")
    return RubricOut.model_validate(rubric)


@router.post("", response_model=RubricOut, status_code=status.HTTP_201_CREATED)
def create_rubric(payload: RubricCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> RubricOut:
    rubric = rubric_crud.create(db, payload)
    audit_crud.create(db, admin.id, "create", "rubric", rubric.id, {"name": rubric.name})
    return RubricOut.model_validate(rubric)


@router.patch("/{rubric_id}", response_model=RubricOut)
def update_rubric(
    rubric_id: int, payload: RubricUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> RubricOut:
    rubric = rubric_crud.get(db, rubric_id)
    if not rubric:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Rubric not found")
    rubric = rubric_crud.update(db, rubric, payload)
    audit_crud.create(db, admin.id, "update", "rubric", rubric.id, {})
    return RubricOut.model_validate(rubric)


@router.post("/{rubric_id}/activate", response_model=RubricOut)
def activate_rubric(rubric_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> RubricOut:
    rubric = rubric_crud.get(db, rubric_id)
    if not rubric:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Rubric not found")
    rubric = rubric_crud.activate(db, rubric)
    audit_crud.create(db, admin.id, "activate", "rubric", rubric.id, {})
    return RubricOut.model_validate(rubric)


@router.delete("/{rubric_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rubric(rubric_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> None:
    rubric = rubric_crud.get(db, rubric_id)
    if not rubric:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Rubric not found")
    audit_crud.create(db, admin.id, "delete", "rubric", rubric.id, {"name": rubric.name})
    rubric_crud.delete(db, rubric)
