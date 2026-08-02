import csv
import io
import math

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.crud import audit as audit_crud
from app.crud import problem_statement as ps_crud
from app.crud import submission as submission_crud
from app.models.enums import VideoType
from app.models.submission import Submission
from app.models.user import User
from app.schemas.common import Page
from app.schemas.submission import (
    BulkImportResult,
    ProblemStatementBrief,
    SubmissionCreate,
    SubmissionOut,
    SubmissionUpdate,
)
from app.services import file_service

router = APIRouter(prefix="/submissions", tags=["submissions"])


def _to_out(submission: Submission) -> SubmissionOut:
    return SubmissionOut(
        id=submission.id,
        project_title=submission.project_title,
        team_identifier=submission.team_identifier,
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
        created_at=submission.created_at,
        updated_at=submission.updated_at,
    )


@router.get("", response_model=Page[SubmissionOut])
def list_submissions(
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    problem_statement_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Page[SubmissionOut]:
    items, total = submission_crud.list_paginated(db, page, page_size, search, problem_statement_id)
    return Page(
        items=[_to_out(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(math.ceil(total / page_size), 1),
    )


@router.get("/{submission_id}", response_model=SubmissionOut)
def get_submission(submission_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> SubmissionOut:
    submission = submission_crud.get(db, submission_id)
    if not submission:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return _to_out(submission)


@router.post("", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
def create_submission(
    payload: SubmissionCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> SubmissionOut:
    if payload.problem_statement_id and not ps_crud.get(db, payload.problem_statement_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Unknown problem_statement_id")
    submission = submission_crud.create(db, payload, admin.id)
    audit_crud.create(db, admin.id, "create", "submission", submission.id, {"project_title": submission.project_title})
    return _to_out(submission)


@router.patch("/{submission_id}", response_model=SubmissionOut)
def update_submission(
    submission_id: int, payload: SubmissionUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> SubmissionOut:
    submission = submission_crud.get(db, submission_id)
    if not submission:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Submission not found")
    submission = submission_crud.update(db, submission, payload)
    audit_crud.create(db, admin.id, "update", "submission", submission.id, payload.model_dump(exclude_unset=True))
    return _to_out(submission)


@router.delete("/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_submission(submission_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> None:
    submission = submission_crud.get(db, submission_id)
    if not submission:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Submission not found")
    for path in (submission.ppt_file_path, submission.pdf_file_path, submission.video_file_path):
        file_service.delete_file(path)
    audit_crud.create(db, admin.id, "delete", "submission", submission.id, {"project_title": submission.project_title})
    submission_crud.delete(db, submission)


@router.post("/{submission_id}/upload/{kind}", response_model=SubmissionOut)
def upload_file(
    submission_id: int,
    kind: str,
    file: UploadFile,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> SubmissionOut:
    if kind not in ("ppt", "pdf", "video"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="kind must be one of: ppt, pdf, video")
    submission = submission_crud.get(db, submission_id)
    if not submission:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Submission not found")

    field = {"ppt": "ppt_file_path", "pdf": "pdf_file_path", "video": "video_file_path"}[kind]
    file_service.delete_file(getattr(submission, field))
    relative_path = file_service.save_submission_file(submission_id, kind, file)
    submission = submission_crud.set_file_path(db, submission, field, relative_path)
    if kind == "video":
        submission.video_type = VideoType.UPLOAD
        db.commit()
        db.refresh(submission)
    audit_crud.create(db, admin.id, "upload", "submission", submission.id, {"kind": kind})
    return _to_out(submission)


@router.get("/{submission_id}/file/{kind}")
def download_file(submission_id: int, kind: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    submission = submission_crud.get(db, submission_id)
    if not submission:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Submission not found")
    field = {"ppt": "ppt_file_path", "pdf": "pdf_file_path", "video": "video_file_path"}.get(kind)
    if field is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="kind must be one of: ppt, pdf, video")
    relative_path = getattr(submission, field)
    if not relative_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No file uploaded for this field")
    return FileResponse(file_service.resolve_path(relative_path))


@router.post("/bulk-import", response_model=BulkImportResult)
def bulk_import(file: UploadFile, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> BulkImportResult:
    """Accepts a CSV with columns: project_title, team_identifier, problem_statement_code,
    short_description, additional_notes, video_type, video_url"""
    raw = file.file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw))

    created = 0
    errors: list[str] = []
    ps_by_code = {ps.code: ps.id for ps in ps_crud.list_all(db)}

    for line_no, row in enumerate(reader, start=2):
        try:
            title = (row.get("project_title") or "").strip()
            team = (row.get("team_identifier") or "").strip()
            if not title or not team:
                raise ValueError("project_title and team_identifier are required")

            code = (row.get("problem_statement_code") or "").strip()
            ps_id = ps_by_code.get(code) if code else None
            if code and ps_id is None:
                raise ValueError(f"Unknown problem_statement_code '{code}'")

            video_type_raw = (row.get("video_type") or "youtube").strip().lower()
            video_type = VideoType(video_type_raw) if video_type_raw in VideoType._value2member_map_ else VideoType.YOUTUBE

            submission = Submission(
                project_title=title,
                team_identifier=team,
                problem_statement_id=ps_id,
                short_description=(row.get("short_description") or "").strip(),
                additional_notes=(row.get("additional_notes") or "").strip() or None,
                video_type=video_type,
                video_url=(row.get("video_url") or "").strip() or None,
                created_by_id=admin.id,
            )
            db.add(submission)
            db.flush()
            created += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Row {line_no}: {exc}")

    db.commit()
    audit_crud.create(db, admin.id, "bulk_import", "submission", None, {"created": created, "failed": len(errors)})
    return BulkImportResult(created=created, failed=len(errors), errors=errors)
