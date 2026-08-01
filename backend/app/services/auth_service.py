from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, generate_numeric_code, hash_secret, verify_secret
from app.crud import access as access_crud
from app.crud import user as user_crud
from app.models.user import User
from app.schemas.auth import OtpRequestResult
from app.services import email_service

_INVALID_CODE = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="That passcode is not valid. Request a new one if it has expired.",
)


def request_otp(db: Session, email: str) -> OtpRequestResult:
    email = user_crud.normalize_email(email)

    allowed = access_crud.get_allowed_by_email(db, email)
    if allowed is None or not allowed.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This email address has not been approved for access. Ask an organizer to add it.",
        )

    existing_user = user_crud.get_by_email(db, email)
    if existing_user is not None and not existing_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated.")

    elapsed = access_crud.seconds_since_last_request(db, email)
    if elapsed is not None and elapsed < settings.OTP_RESEND_COOLDOWN_SECONDS:
        wait = int(settings.OTP_RESEND_COOLDOWN_SECONDS - elapsed) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"A passcode was just sent. Please wait {wait}s before requesting another.",
        )

    if access_crud.count_recent_requests(db, email) >= settings.OTP_MAX_REQUESTS_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many passcode requests for this address. Try again in an hour.",
        )

    code = generate_numeric_code(settings.OTP_LENGTH)
    access_crud.invalidate_outstanding(db, email)
    access_crud.create_otp(db, email, hash_secret(code), settings.OTP_TTL_MINUTES)

    email_service.send_otp_email(email, code, settings.OTP_TTL_MINUTES)

    return OtpRequestResult(
        detail=f"A passcode has been sent to {email}.",
        expires_in_seconds=settings.OTP_TTL_MINUTES * 60,
        dev_passcode=None if settings.smtp_configured else code,
    )


def verify_otp(db: Session, email: str, code: str) -> tuple[User, str]:
    email = user_crud.normalize_email(email)

    allowed = access_crud.get_allowed_by_email(db, email)
    if allowed is None or not allowed.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This email address has not been approved for access.",
        )

    otp = access_crud.latest_active_otp(db, email)
    if otp is None:
        raise _INVALID_CODE

    expires_at = otp.expires_at if otp.expires_at.tzinfo else otp.expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="That passcode has expired. Request a new one.")

    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        access_crud.consume_otp(db, otp)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect attempts. Request a new passcode.",
        )

    if not verify_secret(code.strip(), otp.code_hash):
        access_crud.record_failed_attempt(db, otp)
        raise _INVALID_CODE

    access_crud.consume_otp(db, otp)

    user = user_crud.get_by_email(db, email)
    if user is None:
        user = user_crud.create_user(db, email, allowed.role, allowed.full_name)
    elif not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deactivated.")

    if user.role != allowed.role:
        user.role = allowed.role
    if allowed.full_name and not user.full_name:
        user.full_name = allowed.full_name

    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.email, role=user.role.value)
    return user, token
