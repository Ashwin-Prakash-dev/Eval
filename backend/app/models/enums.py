import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    JUDGE = "judge"


class VideoType(str, enum.Enum):
    UPLOAD = "upload"
    YOUTUBE = "youtube"
    VIMEO = "vimeo"


class EvaluationStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
