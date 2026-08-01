from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.crud import audit as audit_crud
from app.models.user import User
from app.schemas.auth import OtpRequest, OtpRequestResult, OtpVerifyRequest, TokenResponse, UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/request-otp", response_model=OtpRequestResult)
def request_otp(payload: OtpRequest, db: Session = Depends(get_db)) -> OtpRequestResult:
    return auth_service.request_otp(db, payload.email)


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(payload: OtpVerifyRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user, token = auth_service.verify_otp(db, payload.email, payload.code)
    audit_crud.create(db, user.id, "login", "user", user.id, {"email": user.email})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)
