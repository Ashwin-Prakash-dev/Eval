from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.evaluation import Comment, Evaluation, EvaluationScore


def get(db: Session, evaluation_id: int) -> Evaluation | None:
    return db.scalar(
        select(Evaluation)
        .options(joinedload(Evaluation.scores), joinedload(Evaluation.comment))
        .where(Evaluation.id == evaluation_id)
    )


def get_by_assignment(db: Session, assignment_id: int) -> Evaluation | None:
    return db.scalar(
        select(Evaluation)
        .options(joinedload(Evaluation.scores), joinedload(Evaluation.comment))
        .where(Evaluation.assignment_id == assignment_id)
    )


def list_for_judge(db: Session, judge_id: int) -> list[Evaluation]:
    return list(
        db.scalars(
            select(Evaluation)
            .options(joinedload(Evaluation.scores))
            .where(Evaluation.judge_id == judge_id)
        ).unique()
    )


def list_for_submission(db: Session, submission_id: int) -> list[Evaluation]:
    return list(
        db.scalars(
            select(Evaluation)
            .options(joinedload(Evaluation.scores), joinedload(Evaluation.judge))
            .where(Evaluation.submission_id == submission_id)
        ).unique()
    )


def upsert_score(db: Session, evaluation_id: int, criterion_id: int, score: float | None, comment: str | None) -> None:
    existing = db.scalar(
        select(EvaluationScore).where(
            EvaluationScore.evaluation_id == evaluation_id, EvaluationScore.criterion_id == criterion_id
        )
    )
    if existing:
        if score is not None:
            existing.score = score
        if comment is not None:
            existing.comment = comment
    else:
        db.add(EvaluationScore(evaluation_id=evaluation_id, criterion_id=criterion_id, score=score, comment=comment))


def upsert_comment(db: Session, evaluation_id: int, body: str) -> None:
    existing = db.scalar(select(Comment).where(Comment.evaluation_id == evaluation_id))
    if existing:
        existing.body = body
    else:
        db.add(Comment(evaluation_id=evaluation_id, body=body))
