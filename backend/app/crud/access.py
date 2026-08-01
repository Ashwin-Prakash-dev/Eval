from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.crud.user import normalize_email
from app.models.access import AllowedEmail, OtpCode
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import AllowedEmailCreate, AllowedEmailUpdate


def get_allowed(db: Session, allowed_id: int) -> AllowedEmail | None:
    return db.get(AllowedEmail, allowed_id)


def get_allowed_by_email(db: Session, email: str) -> AllowedEmail | None:
    return db.scalar(select(AllowedEmail).where(AllowedEmail.email == normalize_email(email)))


def list_allowed(db: Session, role: UserRole | None = None, search: str | None = None) -> list[AllowedEmail]:
    stmt = select(AllowedEmail).options(joinedload(AllowedEmail.created_by))
    if role is not None:
        stmt = stmt.where(AllowedEmail.role == role)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(AllowedEmail.email.ilike(pattern) | AllowedEmail.full_name.ilike(pattern))
    return list(db.scalars(stmt.order_by(AllowedEmail.created_at.desc())).unique())


def create_allowed(db: Session, payload: AllowedEmailCreate, created_by_id: int | None) -> AllowedEmail:
    entry = AllowedEmail(
        email=normalize_email(payload.email),
        role=payload.role,
        full_name=payload.full_name,
        note=payload.note,
        created_by_id=created_by_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def update_allowed(db: Session, entry: AllowedEmail, payload: AllowedEmailUpdate) -> AllowedEmail:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


def delete_allowed(db: Session, entry: AllowedEmail) -> None:
    db.delete(entry)
    db.commit()


def users_by_email(db: Session, emails: list[str]) -> dict[str, User]:
    if not emails:
        return {}
    rows = db.scalars(select(User).where(User.email.in_(emails)))
    return {user.email: user for user in rows}


def create_otp(db: Session, email: str, code_hash: str, ttl_minutes: int) -> OtpCode:
    otp = OtpCode(
        email=normalize_email(email),
        code_hash=code_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
    )
    db.add(otp)
    db.commit()
    db.refresh(otp)
    return otp


def latest_active_otp(db: Session, email: str) -> OtpCode | None:
    """The most recent unconsumed passcode. Issuing a new one invalidates older ones
    (see `invalidate_outstanding`), so at most one is ever live per address."""
    return db.scalar(
        select(OtpCode)
        .where(OtpCode.email == normalize_email(email), OtpCode.consumed_at.is_(None))
        .order_by(OtpCode.created_at.desc(), OtpCode.id.desc())
    )


def invalidate_outstanding(db: Session, email: str) -> None:
    now = datetime.now(timezone.utc)
    outstanding = db.scalars(
        select(OtpCode).where(OtpCode.email == normalize_email(email), OtpCode.consumed_at.is_(None))
    )
    for otp in outstanding:
        otp.consumed_at = now
    db.commit()


def consume_otp(db: Session, otp: OtpCode) -> None:
    otp.consumed_at = datetime.now(timezone.utc)
    db.commit()


def record_failed_attempt(db: Session, otp: OtpCode) -> None:
    otp.attempts += 1
    db.commit()


def count_recent_requests(db: Session, email: str, within_minutes: int = 60) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=within_minutes)
    rows = db.scalars(select(OtpCode).where(OtpCode.email == normalize_email(email), OtpCode.created_at >= cutoff))
    return len(list(rows))


def seconds_since_last_request(db: Session, email: str) -> float | None:
    last = db.scalar(
        select(OtpCode)
        .where(OtpCode.email == normalize_email(email))
        .order_by(OtpCode.created_at.desc(), OtpCode.id.desc())
    )
    if last is None:
        return None
    created = last.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - created).total_seconds()
