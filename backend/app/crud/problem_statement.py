from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.problem_statement import ProblemStatement
from app.schemas.problem_statement import ProblemStatementCreate, ProblemStatementUpdate


def list_all(db: Session) -> list[ProblemStatement]:
    return list(db.scalars(select(ProblemStatement).order_by(ProblemStatement.code)))


def get(db: Session, ps_id: int) -> ProblemStatement | None:
    return db.get(ProblemStatement, ps_id)


def get_by_code(db: Session, code: str) -> ProblemStatement | None:
    return db.scalar(select(ProblemStatement).where(ProblemStatement.code == code))


def create(db: Session, data: ProblemStatementCreate) -> ProblemStatement:
    ps = ProblemStatement(**data.model_dump())
    db.add(ps)
    db.commit()
    db.refresh(ps)
    return ps


def update(db: Session, ps: ProblemStatement, data: ProblemStatementUpdate) -> ProblemStatement:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ps, field, value)
    db.commit()
    db.refresh(ps)
    return ps


def delete(db: Session, ps: ProblemStatement) -> None:
    db.delete(ps)
    db.commit()
