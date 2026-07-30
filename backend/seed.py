"""Seeds the administrator account and a starter rubric. Safe to run multiple times."""

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.crud import rubric as rubric_crud
from app.crud import user as user_crud
from app.models.enums import UserRole
from app.schemas.rubric import CriterionInput, RubricCreate

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
        admin = user_crud.get_by_username(db, settings.ADMIN_USERNAME)
        if admin is None:
            user_crud.create_user(db, settings.ADMIN_USERNAME, settings.ADMIN_PASSWORD, UserRole.ADMIN, "Administrator")
            print(f"Created admin user '{settings.ADMIN_USERNAME}'")
        else:
            print(f"Admin user '{settings.ADMIN_USERNAME}' already exists, skipping")

        if not rubric_crud.list_all(db):
            rubric = rubric_crud.create(
                db, RubricCreate(name="Default Rubric", disagreement_threshold=settings.DEFAULT_DISAGREEMENT_THRESHOLD, criteria=DEFAULT_CRITERIA)
            )
            rubric_crud.activate(db, rubric)
            print("Created and activated the default rubric")
        else:
            print("A rubric already exists, skipping")
    finally:
        db.close()


if __name__ == "__main__":
    run()
