import statistics

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.crud import rubric as rubric_crud
from app.models.assignment import Assignment
from app.models.enums import EvaluationStatus, UserRole
from app.models.evaluation import Evaluation, SubmissionScore
from app.models.problem_statement import ProblemStatement
from app.models.submission import Submission
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsOverview,
    CriterionAveragePoint,
    DashboardStats,
    JudgeProgressPoint,
    LeaderboardEntry,
    ScoreDistributionBucket,
    SubmissionDistributionPoint,
)

SCORE_BUCKETS = [(1, 2), (2, 4), (4, 6), (6, 8), (8, 10.0001)]


def get_dashboard_stats(db: Session) -> DashboardStats:
    total_submissions = db.scalar(select(func.count()).select_from(Submission)) or 0
    total_judges = db.scalar(select(func.count()).select_from(User).where(User.role == UserRole.JUDGE)) or 0
    total_reviews = db.scalar(select(func.count()).select_from(Assignment)) or 0
    completed_reviews = (
        db.scalar(select(func.count()).select_from(Evaluation).where(Evaluation.status == EvaluationStatus.COMPLETED))
        or 0
    )
    average_score = db.scalar(select(func.avg(SubmissionScore.overall_score)))

    return DashboardStats(
        total_submissions=total_submissions,
        total_judges=total_judges,
        total_reviews=total_reviews,
        completed_reviews=completed_reviews,
        pending_reviews=max(total_reviews - completed_reviews, 0),
        average_score=round(average_score, 3) if average_score is not None else None,
    )


def get_submission_distribution(db: Session) -> list[SubmissionDistributionPoint]:
    rows = db.execute(
        select(ProblemStatement.title, func.count(Submission.id))
        .join(Submission, Submission.problem_statement_id == ProblemStatement.id)
        .group_by(ProblemStatement.title)
        .order_by(ProblemStatement.title)
    ).all()
    points = [SubmissionDistributionPoint(problem_statement=title, count=count) for title, count in rows]

    unassigned = (
        db.scalar(select(func.count()).select_from(Submission).where(Submission.problem_statement_id.is_(None))) or 0
    )
    if unassigned:
        points.append(SubmissionDistributionPoint(problem_statement="Unassigned", count=unassigned))
    return points


def get_judge_progress(db: Session) -> list[JudgeProgressPoint]:
    judges = list(db.scalars(select(User).where(User.role == UserRole.JUDGE).order_by(User.username)))
    points = []
    for judge in judges:
        total = db.scalar(select(func.count()).select_from(Assignment).where(Assignment.judge_id == judge.id)) or 0
        completed = (
            db.scalar(
                select(func.count())
                .select_from(Evaluation)
                .where(Evaluation.judge_id == judge.id, Evaluation.status == EvaluationStatus.COMPLETED)
            )
            or 0
        )
        points.append(
            JudgeProgressPoint(
                judge_id=judge.id,
                judge_name=judge.full_name or judge.username,
                completed=completed,
                pending=max(total - completed, 0),
                total=total,
            )
        )
    return points


def get_score_distribution(db: Session) -> list[ScoreDistributionBucket]:
    scores = list(db.scalars(select(SubmissionScore.overall_score).where(SubmissionScore.overall_score.is_not(None))))
    buckets = []
    for low, high in SCORE_BUCKETS:
        count = sum(1 for s in scores if low <= s < high)
        label = f"{low:g}-{min(high, 10):g}"
        buckets.append(ScoreDistributionBucket(range_label=label, count=count))
    return buckets


def get_criterion_averages(db: Session) -> list[CriterionAveragePoint]:
    rubric = rubric_crud.get_active(db)
    if not rubric:
        return []
    all_means = list(db.scalars(select(SubmissionScore.criterion_means)))
    points = []
    for criterion in rubric.criteria:
        values = [m[str(criterion.id)] for m in all_means if m and str(criterion.id) in m]
        avg = round(statistics.fmean(values), 3) if values else 0.0
        points.append(CriterionAveragePoint(criterion_id=criterion.id, criterion_name=criterion.name, average_score=avg))
    return points


def get_leaderboard(
    db: Session,
    search: str | None = None,
    problem_statement_id: int | None = None,
    sort_by: str = "overall_score",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[LeaderboardEntry], int]:
    rubric = rubric_crud.get_active(db)
    criterion_names = {c.id: c.name for c in rubric.criteria} if rubric else {}

    stmt = (
        select(Submission)
        .options(joinedload(Submission.problem_statement), joinedload(Submission.score_summary))
    )
    if search:
        stmt = stmt.where(Submission.project_title.ilike(f"%{search}%"))
    if problem_statement_id:
        stmt = stmt.where(Submission.problem_statement_id == problem_statement_id)

    submissions = list(db.scalars(stmt).unique())
    total = len(submissions)

    def sort_key(s: Submission):
        summary = s.score_summary
        if sort_by == "std_dev":
            return summary.std_dev if summary and summary.std_dev is not None else -1
        if sort_by == "reviews_completed":
            return summary.reviews_completed if summary else 0
        if sort_by == "project_title":
            return s.project_title.lower()
        return summary.overall_score if summary and summary.overall_score is not None else -1

    submissions.sort(key=sort_key, reverse=(sort_dir == "desc") and sort_by != "project_title")
    if sort_by == "project_title" and sort_dir == "desc":
        submissions.reverse()

    start = (page - 1) * page_size
    page_items = submissions[start : start + page_size]

    entries = []
    for idx, submission in enumerate(page_items, start=start + 1):
        summary = submission.score_summary
        criterion_scores = {}
        if summary and summary.criterion_means:
            criterion_scores = {
                criterion_names.get(int(cid), f"Criterion {cid}"): value
                for cid, value in summary.criterion_means.items()
            }
        entries.append(
            LeaderboardEntry(
                rank=idx,
                submission_id=submission.id,
                project_title=submission.project_title,
                problem_statement=submission.problem_statement.title if submission.problem_statement else None,
                overall_score=summary.overall_score if summary else None,
                criterion_scores=criterion_scores,
                std_dev=summary.std_dev if summary else None,
                reviews_completed=summary.reviews_completed if summary else 0,
                is_flagged=summary.is_flagged if summary else False,
            )
        )
    return entries, total


def get_overview(db: Session) -> AnalyticsOverview:
    leaderboard_preview, _ = get_leaderboard(db, page=1, page_size=5)
    return AnalyticsOverview(
        stats=get_dashboard_stats(db),
        submission_distribution=get_submission_distribution(db),
        judge_progress=get_judge_progress(db),
        score_distribution=get_score_distribution(db),
        criterion_averages=get_criterion_averages(db),
        leaderboard_preview=leaderboard_preview,
    )
