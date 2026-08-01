"""Seeds the administrator's approved email and a starter rubric. Safe to run multiple times.

No password is created: the administrator signs in by requesting a one-time passcode for
ADMIN_EMAIL, exactly like every other user.
"""

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.crud import access as access_crud
from app.crud import rubric as rubric_crud
from app.models.enums import UserRole
from app.schemas.rubric import CriterionInput, RubricCreate
from app.schemas.user import AllowedEmailCreate

DEFAULT_CRITERIA = [
    CriterionInput(name="Innovation", description="Originality and creativity of the idea", weight=30, order_index=0),
    CriterionInput(name="Technical Depth", description="Quality and sophistication of the implementation", weight=25, order_index=1),
    CriterionInput(name="Feasibility", description="Practicality of building and shipping this solution", weight=20, order_index=2),
    CriterionInput(name="Impact", description="Potential real-world impact and reach", weight=15, order_index=3),
    CriterionInput(name="Presentation", description="Clarity and persuasiveness of the pitch", weight=10, order_index=4),
]


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if access_crud.get_allowed_by_email(db, settings.ADMIN_EMAIL) is None:
            access_crud.create_allowed(
                db,
                AllowedEmailCreate(
                    email=settings.ADMIN_EMAIL,
                    role=UserRole.ADMIN,
                    full_name=settings.ADMIN_FULL_NAME,
                    note="Bootstrap administrator",
                ),
                created_by_id=None,
            )
            print(f"Approved administrator email '{settings.ADMIN_EMAIL}'")
        else:
            print(f"Administrator email '{settings.ADMIN_EMAIL}' is already approved, skipping")

        if not rubric_crud.list_all(db):
            rubric = rubric_crud.create(
                db,
                RubricCreate(
                    name="Default Rubric",
                    disagreement_threshold=settings.DEFAULT_DISAGREEMENT_THRESHOLD,
                    criteria=DEFAULT_CRITERIA,
                ),
            )
            rubric_crud.activate(db, rubric)
            print("Created and activated the default rubric")
        else:
            print("A rubric already exists, skipping")

        if not settings.smtp_configured:
            print(
                "\nSMTP is not configured, so sign-in passcodes will be written to the server log\n"
                "instead of emailed (and returned in the API response for the login screen).\n"
                "Set SMTP_HOST and related variables in .env before deploying this."
            )
    finally:
        db.close()


if __name__ == "__main__":
    run()
