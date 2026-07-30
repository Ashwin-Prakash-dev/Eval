from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.crud import audit as audit_crud
from app.crud import problem_statement as ps_crud
from app.models.user import User
from app.schemas.problem_statement import ProblemStatementCreate, ProblemStatementOut, ProblemStatementUpdate

router = APIRouter(prefix="/problem-statements", tags=["problem-statements"])


@router.get("", response_model=list[ProblemStatementOut])
def list_problem_statements(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[ProblemStatementOut]:
    return [ProblemStatementOut.model_validate(p) for p in ps_crud.list_all(db)]


@router.post("", response_model=ProblemStatementOut, status_code=status.HTTP_201_CREATED)
def create_problem_statement(
    payload: ProblemStatementCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> ProblemStatementOut:
    if ps_crud.get_by_code(db, payload.code):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="A problem statement with this code already exists")
    ps = ps_crud.create(db, payload)
    audit_crud.create(db, admin.id, "create", "problem_statement", ps.id, {"code": ps.code})
    return ProblemStatementOut.model_validate(ps)


@router.patch("/{ps_id}", response_model=ProblemStatementOut)
def update_problem_statement(
    ps_id: int, payload: ProblemStatementUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> ProblemStatementOut:
    ps = ps_crud.get(db, ps_id)
    if not ps:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Problem statement not found")
    ps = ps_crud.update(db, ps, payload)
    audit_crud.create(db, admin.id, "update", "problem_statement", ps.id, payload.model_dump(exclude_unset=True))
    return ProblemStatementOut.model_validate(ps)


@router.delete("/{ps_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_problem_statement(ps_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> None:
    ps = ps_crud.get(db, ps_id)
    if not ps:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Problem statement not found")
    audit_crud.create(db, admin.id, "delete", "problem_statement", ps.id, {"code": ps.code})
    ps_crud.delete(db, ps)
