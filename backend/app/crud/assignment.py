from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.assignment import Assignment, ConflictExclusion
from app.models.evaluation import Evaluation


def list_all(db: Session, judge_id: int | None = None, submission_id: int | None = None) -> list[Assignment]:
    stmt = select(Assignment).options(
        joinedload(Assignment.submission), joinedload(Assignment.judge), joinedload(Assignment.evaluation)
    )
    if judge_id:
        stmt = stmt.where(Assignment.judge_id == judge_id)
    if submission_id:
        stmt = stmt.where(Assignment.submission_id == submission_id)
    return list(db.scalars(stmt.order_by(Assignment.assigned_at.desc())).unique())


def get(db: Session, assignment_id: int) -> Assignment | None:
    return db.get(Assignment, assignment_id)


def exists(db: Session, submission_id: int, judge_id: int) -> bool:
    return (
        db.scalar(
            select(func.count()).select_from(Assignment).where(
                Assignment.submission_id == submission_id, Assignment.judge_id == judge_id
            )
        )
        or 0
    ) > 0


def create(db: Session, submission_id: int, judge_id: int, assigned_by_id: int | None, source: str) -> Assignment:
    assignment = Assignment(
        submission_id=submission_id, judge_id=judge_id, assigned_by_id=assigned_by_id, source=source
    )
    db.add(assignment)
    db.flush()
    db.add(Evaluation(assignment_id=assignment.id, submission_id=submission_id, judge_id=judge_id))
    db.commit()
    db.refresh(assignment)
    return assignment


def delete(db: Session, assignment: Assignment) -> None:
    db.delete(assignment)
    db.commit()


def delete_all(db: Session) -> int:
    count = db.scalar(select(func.count()).select_from(Assignment)) or 0
    db.query(Assignment).delete()
    db.commit()
    return count


def load_counts_by_judge(db: Session) -> dict[int, int]:
    rows = db.execute(
        select(Assignment.judge_id, func.count()).group_by(Assignment.judge_id)
    ).all()
    return {judge_id: count for judge_id, count in rows}


def judges_for_submission(db: Session, submission_id: int) -> set[int]:
    rows = db.scalars(select(Assignment.judge_id).where(Assignment.submission_id == submission_id))
    return set(rows)


def all_assignment_pairs(db: Session) -> dict[int, set[int]]:
    """Returns {submission_id: {judge_id, ...}} for every existing assignment in one query."""
    result: dict[int, set[int]] = {}
    for submission_id, judge_id in db.execute(select(Assignment.submission_id, Assignment.judge_id)).all():
        result.setdefault(submission_id, set()).add(judge_id)
    return result


def bulk_create(db: Session, pairs: list[tuple[int, int]], assigned_by_id: int | None) -> int:
    """Creates an Assignment + its linked Evaluation for each (submission_id, judge_id) pair in one transaction."""
    for submission_id, judge_id in pairs:
        assignment = Assignment(
            submission_id=submission_id, judge_id=judge_id, assigned_by_id=assigned_by_id, source="auto"
        )
        db.add(assignment)
        db.flush()
        db.add(Evaluation(assignment_id=assignment.id, submission_id=submission_id, judge_id=judge_id))
    db.commit()
    return len(pairs)


# --- Conflict exclusions -------------------------------------------------

def list_conflicts(db: Session) -> list[ConflictExclusion]:
    return list(db.scalars(select(ConflictExclusion).order_by(ConflictExclusion.created_at.desc())))


def create_conflict(db: Session, submission_id: int, judge_id: int, reason: str | None) -> ConflictExclusion:
    conflict = ConflictExclusion(submission_id=submission_id, judge_id=judge_id, reason=reason)
    db.add(conflict)
    db.commit()
    db.refresh(conflict)
    return conflict


def delete_conflict(db: Session, conflict: ConflictExclusion) -> None:
    db.delete(conflict)
    db.commit()


def get_conflict(db: Session, conflict_id: int) -> ConflictExclusion | None:
    return db.get(ConflictExclusion, conflict_id)


def all_conflict_pairs(db: Session) -> set[tuple[int, int]]:
    rows = db.execute(select(ConflictExclusion.submission_id, ConflictExclusion.judge_id)).all()
    return {(sid, jid) for sid, jid in rows}
