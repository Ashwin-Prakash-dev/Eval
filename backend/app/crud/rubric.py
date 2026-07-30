from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.rubric import EvaluationCriterion, Rubric
from app.schemas.rubric import RubricCreate, RubricUpdate


def get(db: Session, rubric_id: int) -> Rubric | None:
    return db.scalar(select(Rubric).options(joinedload(Rubric.criteria)).where(Rubric.id == rubric_id))


def list_all(db: Session) -> list[Rubric]:
    return list(db.scalars(select(Rubric).options(joinedload(Rubric.criteria)).order_by(Rubric.created_at.desc())).unique())


def get_active(db: Session) -> Rubric | None:
    return db.scalar(select(Rubric).options(joinedload(Rubric.criteria)).where(Rubric.is_active.is_(True)))


def create(db: Session, data: RubricCreate) -> Rubric:
    rubric = Rubric(name=data.name, disagreement_threshold=data.disagreement_threshold, is_active=False)
    db.add(rubric)
    db.flush()
    for criterion in data.criteria:
        db.add(EvaluationCriterion(rubric_id=rubric.id, **criterion.model_dump()))
    db.commit()
    db.refresh(rubric)
    return rubric


def update(db: Session, rubric: Rubric, data: RubricUpdate) -> Rubric:
    payload = data.model_dump(exclude_unset=True, exclude={"criteria"})
    for field, value in payload.items():
        setattr(rubric, field, value)
    if data.criteria is not None:
        for criterion in list(rubric.criteria):
            db.delete(criterion)
        db.flush()
        for criterion in data.criteria:
            db.add(EvaluationCriterion(rubric_id=rubric.id, **criterion.model_dump()))
    db.commit()
    db.refresh(rubric)
    return rubric


def activate(db: Session, rubric: Rubric) -> Rubric:
    db.query(Rubric).filter(Rubric.id != rubric.id).update({Rubric.is_active: False})
    rubric.is_active = True
    db.commit()
    db.refresh(rubric)
    return rubric


def delete(db: Session, rubric: Rubric) -> None:
    db.delete(rubric)
    db.commit()
