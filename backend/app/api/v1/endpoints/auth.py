from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.phase0 import (
    ChangePasswordRequest,
    LoginRequest,
    MeProfileUpdateRequest,
    MeResponse,
    OtpChallengeRequest,
    OtpVerifyRequest,
    TokenResponse,
)
from app.services.auth import (
    change_password,
    login,
    me_payload,
    start_otp,
    update_me_profile,
    verify_otp,
)
from app.services.auth_guard import client_ip, client_user_agent

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login_route(body: LoginRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    return login(db, body.email, body.password, client_ip(request), client_user_agent(request))


@router.post("/otp/challenge")
def otp_challenge(body: OtpChallengeRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    return start_otp(db, body.email, client_ip(request), client_user_agent(request))


@router.post("/otp/verify", response_model=TokenResponse)
def otp_verify(body: OtpVerifyRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    return verify_otp(db, body.email, body.code, client_ip(request), client_user_agent(request))


@router.post("/change-password")
def change_password_route(
    body: ChangePasswordRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return change_password(
        db, user, body.current_password, body.new_password, client_ip(request), client_user_agent(request)
    )


@router.post("/logout")
def logout_route(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Audit the sign-out. Tokens are stateless JWTs, so the client must discard its token."""
    from app.services.audit import write_audit

    write_audit(
        db,
        action="LOGOUT",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        ip_address=client_ip(request),
        user_agent=client_user_agent(request),
    )
    db.commit()
    return {"ok": True}


@router.get("/me", response_model=MeResponse)
def me_route(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return me_payload(db, user)


@router.patch("/me", response_model=MeResponse)
def update_me_route(
    body: MeProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Self-service profile update for the signed-in staff user."""
    return update_me_profile(db, user, body.model_dump(exclude_unset=True))
