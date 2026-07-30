from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.crud import assignment as assignment_crud
from app.crud import audit as audit_crud
from app.crud import submission as submission_crud
from app.crud import user as user_crud
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.assignment import (
    AssignmentOut,
    ConflictExclusionCreate,
    ConflictExclusionOut,
    GenerateAssignmentsRequest,
    GenerateAssignmentsResult,
    ManualAssignmentCreate,
)
from app.services import assignment_service

router = APIRouter(prefix="/assignments", tags=["assignments"])


def _to_out(assignment) -> AssignmentOut:
    return AssignmentOut(
        id=assignment.id,
        submission=assignment.submission,
        judge=assignment.judge,
        source=assignment.source,
        assigned_at=assignment.assigned_at,
        evaluation_status=assignment.evaluation.status.value if assignment.evaluation else "not_started",
    )


@router.get("", response_model=list[AssignmentOut])
def list_assignments(
    judge_id: int | None = None,
    submission_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[AssignmentOut]:
    return [_to_out(a) for a in assignment_crud.list_all(db, judge_id, submission_id)]


@router.post("/generate", response_model=GenerateAssignmentsResult)
def generate(
    payload: GenerateAssignmentsRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> GenerateAssignmentsResult:
    result = assignment_service.generate_assignments(db, payload, admin.id)
    audit_crud.create(db, admin.id, "generate", "assignment", None, result.model_dump())
    return result


@router.post("", response_model=AssignmentOut, status_code=status.HTTP_201_CREATED)
def create_manual_assignment(
    payload: ManualAssignmentCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> AssignmentOut:
    if not submission_crud.get(db, payload.submission_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Submission not found")
    judge = user_crud.get_by_id(db, payload.judge_id)
    if not judge or judge.role != UserRole.JUDGE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Judge not found")
    if assignment_crud.exists(db, payload.submission_id, payload.judge_id):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="This judge is already assigned to this submission")

    assignment = assignment_crud.create(db, payload.submission_id, payload.judge_id, admin.id, source="manual")
    audit_crud.create(
        db, admin.id, "create", "assignment", assignment.id,
        {"submission_id": payload.submission_id, "judge_id": payload.judge_id},
    )
    return _to_out(assignment)


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> None:
    assignment = assignment_crud.get(db, assignment_id)
    if not assignment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    audit_crud.create(
        db, admin.id, "delete", "assignment", assignment.id,
        {"submission_id": assignment.submission_id, "judge_id": assignment.judge_id},
    )
    assignment_crud.delete(db, assignment)


@router.get("/conflicts", response_model=list[ConflictExclusionOut])
def list_conflicts(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[ConflictExclusionOut]:
    return [ConflictExclusionOut.model_validate(c) for c in assignment_crud.list_conflicts(db)]


@router.post("/conflicts", response_model=ConflictExclusionOut, status_code=status.HTTP_201_CREATED)
def create_conflict(
    payload: ConflictExclusionCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> ConflictExclusionOut:
    conflict = assignment_crud.create_conflict(db, payload.submission_id, payload.judge_id, payload.reason)
    audit_crud.create(db, admin.id, "create", "conflict_exclusion", conflict.id, {})
    return ConflictExclusionOut.model_validate(conflict)


@router.delete("/conflicts/{conflict_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conflict(conflict_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> None:
    conflict = assignment_crud.get_conflict(db, conflict_id)
    if not conflict:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Conflict exclusion not found")
    audit_crud.create(db, admin.id, "delete", "conflict_exclusion", conflict.id, {})
    assignment_crud.delete_conflict(db, conflict)
