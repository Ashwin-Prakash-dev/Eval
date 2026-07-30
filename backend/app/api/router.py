from fastapi import APIRouter

from app.api.routes import (
    analytics,
    assignments,
    audit_logs,
    auth,
    evaluations,
    export,
    judges,
    problem_statements,
    rubrics,
    submissions,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(judges.router)
api_router.include_router(problem_statements.router)
api_router.include_router(submissions.router)
api_router.include_router(rubrics.router)
api_router.include_router(assignments.router)
api_router.include_router(evaluations.router)
api_router.include_router(analytics.router)
api_router.include_router(export.router)
api_router.include_router(audit_logs.router)
