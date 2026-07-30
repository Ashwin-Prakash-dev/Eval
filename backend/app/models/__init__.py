"""Import every mapped model so SQLAlchemy's registry can resolve string-based relationships."""

from app.models.assignment import Assignment, ConflictExclusion
from app.models.audit_log import AuditLog
from app.models.evaluation import Comment, Evaluation, EvaluationScore, SubmissionScore
from app.models.problem_statement import ProblemStatement
from app.models.rubric import EvaluationCriterion, Rubric
from app.models.submission import Submission
from app.models.user import User

__all__ = [
    "Assignment",
    "ConflictExclusion",
    "AuditLog",
    "Comment",
    "Evaluation",
    "EvaluationScore",
    "SubmissionScore",
    "ProblemStatement",
    "EvaluationCriterion",
    "Rubric",
    "Submission",
    "User",
]
