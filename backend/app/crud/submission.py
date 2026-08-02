from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.submission import Submission
from app.schemas.submission import SubmissionCreate, SubmissionUpdate


def get(db: Session, submission_id: int) -> Submission | None:
    return db.scalar(
        select(Submission)
        .options(joinedload(Submission.problem_statement))
        .where(Submission.id == submission_id)
    )


def list_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    problem_statement_id: int | None = None,
) -> tuple[list[Submission], int]:
    stmt = select(Submission).options(joinedload(Submission.problem_statement))
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            or_(Submission.project_title.ilike(like), Submission.team_identifier.ilike(like))
        )
    if problem_statement_id:
        stmt = stmt.where(Submission.problem_statement_id == problem_statement_id)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    stmt = stmt.order_by(Submission.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list(db.scalars(stmt))
    return items, total


def create(db: Session, data: SubmissionCreate, created_by_id: int | None) -> Submission:
    submission = Submission(**data.model_dump(), created_by_id=created_by_id)
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


def update(db: Session, submission: Submission, data: SubmissionUpdate) -> Submission:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(submission, field, value)
    db.commit()
    db.refresh(submission)
    return submission


def delete(db: Session, submission: Submission) -> None:
    db.delete(submission)
    db.commit()


def set_file_path(db: Session, submission: Submission, field: str, path: str) -> Submission:
    setattr(submission, field, path)
    db.commit()
    db.refresh(submission)
    return submission
