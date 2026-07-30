from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import require_admin, require_judge
from app.core.database import get_db
from app.crud import assignment as assignment_crud
from app.crud import evaluation as evaluation_crud
from app.crud import rubric as rubric_crud
from app.models.enums import EvaluationStatus
from app.models.evaluation import Evaluation
from app.models.submission import Submission
from app.models.user import User
from app.schemas.evaluation import (
    CriterionBrief,
    EvaluationAdminOut,
    EvaluationAutosaveRequest,
    EvaluationDetailOut,
    EvaluationJudgeBrief,
    EvaluationOut,
    JudgeProgressOut,
    ScoreOut,
)
from app.schemas.submission import ProblemStatementBrief, SubmissionJudgeOut
from app.services import file_service, scoring_service

router = APIRouter(prefix="/evaluations", tags=["evaluations"])


def _evaluation_out(evaluation: Evaluation) -> EvaluationOut:
    overall_comment = evaluation.comment.body if evaluation.comment else None
    return EvaluationOut(
        id=evaluation.id,
        assignment_id=evaluation.assignment_id,
        submission_id=evaluation.submission_id,
        status=evaluation.status,
        weighted_overall_score=evaluation.weighted_overall_score,
        time_spent_seconds=evaluation.time_spent_seconds,
        started_at=evaluation.started_at,
        completed_at=evaluation.completed_at,
        updated_at=evaluation.updated_at,
        overall_comment=overall_comment,
        scores=[ScoreOut(criterion_id=s.criterion_id, score=s.score, comment=s.comment) for s in evaluation.scores],
    )


def _submission_judge_out(submission: Submission) -> SubmissionJudgeOut:
    return SubmissionJudgeOut(
        id=submission.id,
        project_title=submission.project_title,
        short_description=submission.short_description,
        additional_notes=submission.additional_notes,
        problem_statement=(
            ProblemStatementBrief.model_validate(submission.problem_statement)
            if submission.problem_statement
            else None
        ),
        has_ppt=bool(submission.ppt_file_path),
        has_pdf=bool(submission.pdf_file_path),
        video_type=submission.video_type,
        video_url=submission.video_url,
        has_video_file=bool(submission.video_file_path),
    )


def _ensure_owns_evaluation(evaluation: Evaluation | None, judge: User) -> Evaluation:
    if not evaluation or evaluation.judge_id != judge.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Evaluation not found")
    return evaluation


@router.get("/assigned", response_model=list[EvaluationDetailOut])
def list_assigned(db: Session = Depends(get_db), judge: User = Depends(require_judge)) -> list[EvaluationDetailOut]:
    rubric = rubric_crud.get_active(db)
    criteria = (
        [CriterionBrief.model_validate(c) for c in rubric.criteria] if rubric else []
    )
    assignments = assignment_crud.list_all(db, judge_id=judge.id)
    results = []
    for assignment in assignments:
        evaluation = evaluation_crud.get_by_assignment(db, assignment.id)
        results.append(
            EvaluationDetailOut(
                evaluation=_evaluation_out(evaluation),
                submission=_submission_judge_out(assignment.submission),
                criteria=criteria,
            )
        )
    return results


@router.get("/progress", response_model=JudgeProgressOut)
def progress(db: Session = Depends(get_db), judge: User = Depends(require_judge)) -> JudgeProgressOut:
    evaluations = evaluation_crud.list_for_judge(db, judge.id)
    total = len(evaluations)
    completed = sum(1 for e in evaluations if e.status == EvaluationStatus.COMPLETED)
    in_progress = sum(1 for e in evaluations if e.status == EvaluationStatus.IN_PROGRESS)
    not_started = total - completed - in_progress
    return JudgeProgressOut(
        total_assigned=total,
        completed=completed,
        in_progress=in_progress,
        not_started=not_started,
        percent_complete=round((completed / total) * 100, 1) if total else 0.0,
    )


@router.get("/{evaluation_id}", response_model=EvaluationDetailOut)
def get_evaluation(evaluation_id: int, db: Session = Depends(get_db), judge: User = Depends(require_judge)) -> EvaluationDetailOut:
    evaluation = _ensure_owns_evaluation(evaluation_crud.get(db, evaluation_id), judge)
    rubric = rubric_crud.get_active(db)
    criteria = [CriterionBrief.model_validate(c) for c in rubric.criteria] if rubric else []
    assignment = assignment_crud.get(db, evaluation.assignment_id)
    return EvaluationDetailOut(
        evaluation=_evaluation_out(evaluation), submission=_submission_judge_out(assignment.submission), criteria=criteria
    )


@router.patch("/{evaluation_id}", response_model=EvaluationOut)
def autosave_evaluation(
    evaluation_id: int,
    payload: EvaluationAutosaveRequest,
    db: Session = Depends(get_db),
    judge: User = Depends(require_judge),
) -> EvaluationOut:
    evaluation = _ensure_owns_evaluation(evaluation_crud.get(db, evaluation_id), judge)

    if evaluation.started_at is None:
        evaluation.started_at = datetime.now(timezone.utc)

    for entry in payload.scores:
        evaluation_crud.upsert_score(db, evaluation.id, entry.criterion_id, entry.score, entry.comment)

    if payload.overall_comment is not None:
        evaluation_crud.upsert_comment(db, evaluation.id, payload.overall_comment)

    if payload.time_spent_delta_seconds:
        evaluation.time_spent_seconds += payload.time_spent_delta_seconds

    if payload.mark_complete is True:
        evaluation.status = EvaluationStatus.COMPLETED
        evaluation.completed_at = datetime.now(timezone.utc)
    elif payload.mark_complete is False:
        evaluation.status = EvaluationStatus.IN_PROGRESS
        evaluation.completed_at = None
    elif evaluation.status == EvaluationStatus.NOT_STARTED:
        evaluation.status = EvaluationStatus.IN_PROGRESS

    db.commit()
    db.refresh(evaluation)

    if evaluation.status == EvaluationStatus.COMPLETED or evaluation.completed_at is not None:
        scoring_service.recompute_submission_score(db, evaluation.submission_id)
    db.refresh(evaluation)

    return _evaluation_out(evaluation)


@router.get("/{evaluation_id}/file/{kind}")
def evaluation_file(evaluation_id: int, kind: str, db: Session = Depends(get_db), judge: User = Depends(require_judge)):
    evaluation = _ensure_owns_evaluation(evaluation_crud.get(db, evaluation_id), judge)
    assignment = assignment_crud.get(db, evaluation.assignment_id)
    field = {"ppt": "ppt_file_path", "pdf": "pdf_file_path", "video": "video_file_path"}.get(kind)
    if field is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="kind must be one of: ppt, pdf, video")
    relative_path = getattr(assignment.submission, field)
    if not relative_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No file uploaded for this field")
    return FileResponse(file_service.resolve_path(relative_path))


@router.get("/submission/{submission_id}/all", response_model=list[EvaluationAdminOut])
def list_for_submission(submission_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[EvaluationAdminOut]:
    """Admin-only view of every judge's evaluation for a given submission."""
    evaluations = evaluation_crud.list_for_submission(db, submission_id)
    return [
        EvaluationAdminOut(**_evaluation_out(e).model_dump(), judge=EvaluationJudgeBrief.model_validate(e.judge))
        for e in evaluations
    ]
