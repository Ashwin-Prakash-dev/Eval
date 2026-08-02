from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud import assignment as assignment_crud
from app.models.enums import UserRole
from app.models.submission import Submission
from app.models.user import User
from app.schemas.assignment import GenerateAssignmentsRequest, GenerateAssignmentsResult


def generate_assignments(
    db: Session, request: GenerateAssignmentsRequest, generated_by_id: int | None
) -> GenerateAssignmentsResult:
    """Greedy least-loaded assignment generator.

    Guarantees, for every submission that still needs coverage, exactly
    `judges_per_submission` distinct judges (excluding conflicts), while keeping
    per-judge load as balanced as possible. Safe to re-run incrementally: submissions
    that already have enough judges are skipped, and existing load is respected.
    """
    warnings: list[str] = []

    if request.reset_existing:
        assignment_crud.delete_all(db)

    submission_ids = list(db.scalars(select(Submission.id).order_by(Submission.id)))
    judge_ids = list(
        db.scalars(
            select(User.id).where(User.role == UserRole.JUDGE, User.is_active.is_(True)).order_by(User.id)
        )
    )

    if not submission_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="There are no submissions to assign.")
    if not judge_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="There are no active judges to assign.")
    if request.judges_per_submission > len(judge_ids):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=(
                f"judges_per_submission ({request.judges_per_submission}) exceeds the number "
                f"of active judges ({len(judge_ids)})."
            ),
        )

    conflict_pairs = assignment_crud.all_conflict_pairs(db)
    assigned_by_submission = assignment_crud.all_assignment_pairs(db)
    load = {jid: 0 for jid in judge_ids}
    for existing_load in assignment_crud.load_counts_by_judge(db).items():
        jid, count = existing_load
        if jid in load:
            load[jid] = count

    new_pairs: list[tuple[int, int]] = []

    for sid in submission_ids:
        already = assigned_by_submission.get(sid, set())
        need = request.judges_per_submission - len(already)
        if need <= 0:
            continue

        eligible = [j for j in judge_ids if j not in already and (sid, j) not in conflict_pairs]
        if len(eligible) < need:
            warnings.append(
                f"Submission #{sid}: only {len(eligible)} eligible judge(s) available "
                f"(needed {need}); assigned as many as possible."
            )
        eligible.sort(key=lambda j: (load[j], j))
        chosen = eligible[:need]

        for jid in chosen:
            new_pairs.append((sid, jid))
            load[jid] += 1
            assigned_by_submission.setdefault(sid, set()).add(jid)

    created = assignment_crud.bulk_create(db, new_pairs, generated_by_id)

    final_loads = list(load.values())
    return GenerateAssignmentsResult(
        assignments_created=created,
        submissions_covered=len(submission_ids),
        judges_used=len(judge_ids),
        min_load=min(final_loads) if final_loads else 0,
        max_load=max(final_loads) if final_loads else 0,
        warnings=warnings,
    )
