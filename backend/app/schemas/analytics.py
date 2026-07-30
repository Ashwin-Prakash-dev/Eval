from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_submissions: int
    total_judges: int
    total_reviews: int
    completed_reviews: int
    pending_reviews: int
    average_score: float | None


class SubmissionDistributionPoint(BaseModel):
    problem_statement: str
    count: int


class JudgeProgressPoint(BaseModel):
    judge_id: int
    judge_name: str
    completed: int
    pending: int
    total: int


class ScoreDistributionBucket(BaseModel):
    range_label: str
    count: int


class CriterionAveragePoint(BaseModel):
    criterion_id: int
    criterion_name: str
    average_score: float


class LeaderboardEntry(BaseModel):
    rank: int
    submission_id: int
    project_title: str
    problem_statement: str | None
    overall_score: float | None
    criterion_scores: dict[str, float]
    std_dev: float | None
    reviews_completed: int
    is_flagged: bool


class AnalyticsOverview(BaseModel):
    stats: DashboardStats
    submission_distribution: list[SubmissionDistributionPoint]
    judge_progress: list[JudgeProgressPoint]
    score_distribution: list[ScoreDistributionBucket]
    criterion_averages: list[CriterionAveragePoint]
    leaderboard_preview: list[LeaderboardEntry]
