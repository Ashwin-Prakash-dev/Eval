import logging
import smtplib
from email.message import EmailMessage

from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger("app.email")


def _build_message(to_email: str, subject: str, body: str) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    message["To"] = to_email
    message.set_content(body)
    return message


def send_email(to_email: str, subject: str, body: str) -> None:
    """Delivers over SMTP. With no SMTP host configured the message is logged instead —
    that keeps local development runnable without a mail server, and is why
    `smtp_configured` gates the dev passcode echo in the auth service."""
    if not settings.smtp_configured:
        logger.warning("SMTP not configured — logging message instead of sending.\nTo: %s\n%s\n\n%s", to_email, subject, body)
        return

    username = (settings.SMTP_USERNAME or "").strip()
    password = (settings.SMTP_PASSWORD or "").replace(" ", "")

    if username and not password:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "SMTP_USERNAME is set but SMTP_PASSWORD is empty, so the mail server will reject "
                "the message as unauthenticated. Set SMTP_PASSWORD and restart the backend."
            ),
        )

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if username and password:
                server.login(username, password)
            server.send_message(_build_message(to_email, subject, body))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to send email to %s", to_email)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not send the passcode email. Check the mail server configuration.",
        ) from exc


def send_otp_email(to_email: str, code: str, ttl_minutes: int) -> None:
    body = (
        f"Your sign-in passcode for the {settings.APP_NAME} is:\n\n"
        f"    {code}\n\n"
        f"It expires in {ttl_minutes} minutes and can only be used once.\n\n"
        "If you did not request this, you can ignore this email — no one can sign in without the passcode."
    )
    send_email(to_email, f"{code} is your sign-in passcode", body)
