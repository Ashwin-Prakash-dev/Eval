import statistics
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.crud import rubric as rubric_crud
from app.models.enums import EvaluationStatus, UserRole
from app.models.evaluation import Evaluation, SubmissionScore
from app.models.user import User
from app.schemas.user import JudgeStats as JudgeStatsSchema


def _weighted_overall(scores_by_criterion: dict[int, float], weight_by_criterion: dict[int, float]) -> float | None:
    relevant = {cid: s for cid, s in scores_by_criterion.items() if cid in weight_by_criterion and s is not None}
    if not relevant:
        return None
    return sum(s * (weight_by_criterion[cid] / 100.0) for cid, s in relevant.items())


def recompute_submission_score(db: Session, submission_id: int) -> SubmissionScore:
    rubric = rubric_crud.get_active(db)
    weight_by_criterion = {c.id: c.weight for c in rubric.criteria} if rubric else {}
    threshold = rubric.disagreement_threshold if rubric else 1.5

    completed = list(
        db.scalars(
            select(Evaluation)
            .options(joinedload(Evaluation.scores))
            .where(
                Evaluation.submission_id == submission_id,
                Evaluation.status == EvaluationStatus.COMPLETED,
            )
        ).unique()
    )

    per_judge_overall: list[float] = []
    per_criterion_values: dict[int, list[float]] = {}

    for evaluation in completed:
        scores_by_criterion = {s.criterion_id: s.score for s in evaluation.scores if s.score is not None}
        for cid, value in scores_by_criterion.items():
            per_criterion_values.setdefault(cid, []).append(value)
        overall = _weighted_overall(scores_by_criterion, weight_by_criterion)
        evaluation.weighted_overall_score = round(overall, 3) if overall is not None else None
        if overall is not None:
            per_judge_overall.append(overall)

    criterion_means = {
        str(cid): round(statistics.fmean(values), 3) for cid, values in per_criterion_values.items()
    }

    summary = db.get(SubmissionScore, submission_id)
    if summary is None:
        summary = SubmissionScore(submission_id=submission_id)
        db.add(summary)

    if per_judge_overall:
        summary.overall_score = round(statistics.fmean(per_judge_overall), 3)
        summary.highest_score = round(max(per_judge_overall), 3)
        summary.lowest_score = round(min(per_judge_overall), 3)
        summary.std_dev = round(statistics.pstdev(per_judge_overall), 3) if len(per_judge_overall) > 1 else 0.0
        summary.is_flagged = summary.std_dev is not None and summary.std_dev > threshold
    else:
        summary.overall_score = None
        summary.highest_score = None
        summary.lowest_score = None
        summary.std_dev = None
        summary.is_flagged = False

    summary.criterion_means = criterion_means
    summary.reviews_completed = len(completed)
    summary.computed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(summary)
    return summary


def compute_judge_stats(db: Session) -> list[JudgeStatsSchema]:
    from app.schemas.user import JudgeOut

    rubric = rubric_crud.get_active(db)
    weight_by_criterion = {c.id: c.weight for c in rubric.criteria} if rubric else {}

    judges = list(db.scalars(select(User).where(User.role == UserRole.JUDGE)))
    per_judge_avg: dict[int, float] = {}
    per_judge_std: dict[int, float] = {}
    raw_stats: list[dict] = []

    for judge in judges:
        evaluations = list(
            db.scalars(
                select(Evaluation).options(joinedload(Evaluation.scores)).where(Evaluation.judge_id == judge.id)
            ).unique()
        )
        assigned = len(evaluations)
        completed_evals = [e for e in evaluations if e.status == EvaluationStatus.COMPLETED]
        completed = len(completed_evals)
        pending = assigned - completed

        overalls = []
        review_times = []
        for evaluation in completed_evals:
            scores_by_criterion = {s.criterion_id: s.score for s in evaluation.scores if s.score is not None}
            overall = _weighted_overall(scores_by_criterion, weight_by_criterion)
            if overall is not None:
                overalls.append(overall)
            if evaluation.time_spent_seconds:
                review_times.append(evaluation.time_spent_seconds)

        avg_score = round(statistics.fmean(overalls), 3) if overalls else None
        std_dev = round(statistics.pstdev(overalls), 3) if len(overalls) > 1 else (0.0 if overalls else None)
        avg_time = round(statistics.fmean(review_times), 1) if review_times else None

        if avg_score is not None:
            per_judge_avg[judge.id] = avg_score
        if std_dev is not None:
            per_judge_std[judge.id] = std_dev

        raw_stats.append(
            {
                "judge": judge,
                "assigned": assigned,
                "completed": completed,
                "pending": pending,
                "avg_score": avg_score,
                "std_dev": std_dev,
                "avg_time": avg_time,
            }
        )

    population_avgs = list(per_judge_avg.values())
    population_mean = statistics.fmean(population_avgs) if population_avgs else None
    population_std = statistics.pstdev(population_avgs) if len(population_avgs) > 1 else 0.0

    population_stds = list(per_judge_std.values())
    stds_mean = statistics.fmean(population_stds) if population_stds else None
    stds_std = statistics.pstdev(population_stds) if len(population_stds) > 1 else 0.0

    results: list[JudgeStatsSchema] = []
    for entry in raw_stats:
        avg_score = entry["avg_score"]
        std_dev = entry["std_dev"]

        is_harsh = (
            avg_score is not None
            and population_mean is not None
            and avg_score < population_mean - max(population_std, 0.5)
        )
        is_lenient = (
            avg_score is not None
            and population_mean is not None
            and avg_score > population_mean + max(population_std, 0.5)
        )
        is_high_variance = (
            std_dev is not None
            and stds_mean is not None
            and std_dev > stds_mean + max(stds_std, 0.5)
        )

        results.append(
            JudgeStatsSchema(
                judge=JudgeOut.model_validate(entry["judge"]),
                reviews_assigned=entry["assigned"],
                reviews_completed=entry["completed"],
                reviews_pending=entry["pending"],
                average_score_given=avg_score,
                std_dev_given=std_dev,
                average_review_time_seconds=entry["avg_time"],
                is_harsh=is_harsh,
                is_lenient=is_lenient,
                is_high_variance=is_high_variance,
            )
        )

    return results
