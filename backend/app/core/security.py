import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from jwt import PyJWTError

from app.core.config import settings


def hash_secret(plain_secret: str) -> str:
    return bcrypt.hashpw(plain_secret.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_secret(plain_secret: str, secret_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_secret.encode("utf-8"), secret_hash.encode("utf-8"))
    except ValueError:
        return False


def generate_numeric_code(length: int) -> str:
    """Cryptographically secure, zero-padded so every code is exactly `length` digits."""
    upper_bound = 10**length
    return str(secrets.randbelow(upper_bound)).zfill(length)


def create_access_token(subject: str, role: str, expires_minutes: int | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: dict[str, Any] = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except PyJWTError:
        return None
