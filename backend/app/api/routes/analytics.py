import math

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.models.user import User
from app.schemas.analytics import AnalyticsOverview, LeaderboardEntry
from app.schemas.common import Page
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverview)
def overview(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> AnalyticsOverview:
    return analytics_service.get_overview(db)


@router.get("/leaderboard", response_model=Page[LeaderboardEntry])
def leaderboard(
    search: str | None = None,
    problem_statement_id: int | None = None,
    sort_by: str = "overall_score",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 25,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Page[LeaderboardEntry]:
    entries, total = analytics_service.get_leaderboard(
        db, search, problem_statement_id, sort_by, sort_dir, page, page_size
    )
    return Page(
        items=entries, total=total, page=page, page_size=page_size, total_pages=max(math.ceil(total / page_size), 1)
    )
