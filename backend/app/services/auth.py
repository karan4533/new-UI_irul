import secrets
from datetime import datetime, timedelta, timezone
from functools import cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.passwords import password_policy_message
from app.core.security import create_access_token, hash_password, verify_password
from app.deps import permission_codes_for, role_code_for
from app.models import Campus, OtpChallenge, Role, User
from app.services import auth_guard
from app.services.audit import write_audit
from app.services.errors import fail

OTP_CHALLENGE_MESSAGE = "If an account exists for this email, a one-time code has been generated."


@cache
def _dummy_hash() -> str:
    """A real bcrypt hash used to spend the same time when the account does not exist."""
    return hash_password(secrets.token_urlsafe(16))


def login(
    db: Session, email: str, password: str, ip: str = "unknown", user_agent: str | None = None
) -> dict:
    normalized = email.lower().strip()
    auth_guard.assert_login_allowed(normalized, ip)
    user = db.scalar(select(User).where(User.email == normalized))
    # Always run one bcrypt check so unknown and known emails take comparable time.
    password_ok = verify_password(password, user.password_hash if user else _dummy_hash())
    if user is None or not password_ok or not user.is_active:
        auth_guard.record_login_failure(db, normalized, ip)
        write_audit(
            db,
            action="LOGIN_FAILED",
            entity_type="user",
            details=normalized,
            ip_address=ip,
            user_agent=user_agent,
        )
        db.commit()
        fail(401, "invalid_credentials", "Invalid email or password.")
    auth_guard.record_login_success(normalized)
    write_audit(
        db,
        action="LOGIN",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        ip_address=ip,
        user_agent=user_agent,
    )
    db.commit()
    return _token_payload(db, user)


def start_otp(
    db: Session, email: str, ip: str = "unknown", user_agent: str | None = None
) -> dict:
    """Issue a one-time code. The response is identical for known and unknown emails."""
    normalized = email.lower().strip()
    auth_guard.check_otp_challenge_allowed(normalized, ip)
    user = db.scalar(select(User).where(User.email == normalized))
    body = {
        "email": normalized,
        "expires_in_minutes": settings.otp_expire_minutes,
        "message": OTP_CHALLENGE_MESSAGE,
    }
    code = f"{secrets.randbelow(1_000_000):06d}"
    code_hash = hash_password(code)  # same bcrypt cost whether or not the account exists
    if user is None or not user.is_active:
        write_audit(
            db,
            action="OTP_CHALLENGE_UNKNOWN",
            entity_type="user",
            details=normalized,
            ip_address=ip,
            user_agent=user_agent,
        )
        db.commit()
        return body
    now = datetime.now(timezone.utc)
    for old in db.scalars(
        select(OtpChallenge).where(OtpChallenge.email == normalized, OtpChallenge.consumed_at.is_(None))
    ).all():
        old.consumed_at = now
    db.add(
        OtpChallenge(
            email=normalized,
            code_hash=code_hash,
            expires_at=now + timedelta(minutes=settings.otp_expire_minutes),
        )
    )
    write_audit(
        db,
        action="OTP_CHALLENGE",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        ip_address=ip,
        user_agent=user_agent,
    )
    db.commit()
    # Development convenience only; never disclosed unless ENVIRONMENT=development and OTP_DEBUG=true.
    if settings.otp_debug_enabled:
        body["debug_code"] = code
    return body


def _otp_failed(
    db: Session, normalized: str, ip: str, user_agent: str | None = None
) -> None:
    auth_guard.record_otp_failure(db, normalized, ip)
    write_audit(
        db,
        action="OTP_FAILED",
        entity_type="user",
        details=normalized,
        ip_address=ip,
        user_agent=user_agent,
    )
    db.commit()
    fail(401, "invalid_otp", "The code is invalid or expired.")


def verify_otp(
    db: Session, email: str, code: str, ip: str = "unknown", user_agent: str | None = None
) -> dict:
    normalized = email.lower().strip()
    auth_guard.assert_otp_verify_allowed(normalized, ip)
    now = datetime.now(timezone.utc)
    challenge = db.scalar(
        select(OtpChallenge)
        .where(OtpChallenge.email == normalized, OtpChallenge.consumed_at.is_(None))
        .order_by(OtpChallenge.created_at.desc())
    )
    if challenge is None:
        verify_password(code, _dummy_hash())  # keep timing comparable
        _otp_failed(db, normalized, ip, user_agent)
    expires = challenge.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now or not verify_password(code, challenge.code_hash):
        _otp_failed(db, normalized, ip, user_agent)
    user = db.scalar(select(User).where(User.email == normalized))
    if user is None or not user.is_active:
        _otp_failed(db, normalized, ip, user_agent)
    auth_guard.record_otp_success(normalized)
    challenge.consumed_at = now
    write_audit(
        db,
        action="OTP_VERIFIED",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        ip_address=ip,
        user_agent=user_agent,
    )
    db.commit()
    return _token_payload(db, user)


def change_password(
    db: Session,
    user: User,
    current_password: str,
    new_password: str,
    ip: str = "unknown",
    user_agent: str | None = None,
) -> dict:
    # A stolen token must not allow unlimited guessing of the current password.
    auth_guard.assert_login_allowed(user.email, ip)
    if not verify_password(current_password, user.password_hash):
        auth_guard.record_login_failure(db, user.email, ip)
        write_audit(
            db,
            action="PASSWORD_CHANGE_FAILED",
            entity_type="user",
            entity_id=str(user.id),
            actor_id=user.id,
            campus_id=user.campus_id,
            ip_address=ip,
            user_agent=user_agent,
        )
        db.commit()
        fail(401, "invalid_credentials", "Current password is incorrect.")
    if current_password == new_password:
        fail(422, "same_password", "Pick a new password that is different from the current one.")
    policy_message = password_policy_message(new_password, email=user.email)
    if policy_message:
        fail(422, "weak_password", policy_message)
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    write_audit(
        db,
        action="PASSWORD_CHANGED",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        ip_address=ip,
        user_agent=user_agent,
    )
    db.commit()
    return {"ok": True, "must_change_password": False}


def _join_name(*parts: str) -> str:
    return " ".join(part for part in parts if part and str(part).strip())


def _ensure_self_profile(db: Session, user: User, role_code: str):
    """Return the staff UserProfile for this login, creating a minimal one if missing."""
    from app.models import UserProfile
    from app.services.admin_users import _next_staff_code

    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    if profile is not None:
        return profile
    prefix = (role_code or "STAFF")[:3].upper()
    local = (user.email or "staff").split("@", 1)[0]
    first = local.replace(".", " ").replace("_", " ").strip().title() or "Staff"
    profile = UserProfile(
        user_id=user.id,
        campus_id=user.campus_id,
        staff_code=_next_staff_code(db, user.campus_id, prefix),
        first_name=first.split(" ", 1)[0][:120],
        middle_name="",
        last_name=(first.split(" ", 1)[1] if " " in first else "")[:120],
        gender="",
        mobile_number="",
        extra={},
        created_by=user.id,
    )
    db.add(profile)
    db.flush()
    return profile


def _hr_self(db: Session, user: User):
    from app.models import HrEmployee

    by_user = db.scalar(select(HrEmployee).where(HrEmployee.user_id == user.id))
    if by_user is not None:
        return by_user
    return db.scalar(select(HrEmployee).where(HrEmployee.email == user.email))


def me_payload(db: Session, user: User) -> dict:
    role = db.get(Role, user.role_id)
    campus = db.get(Campus, user.campus_id)
    role_code = role.code if role else ""
    profile = _ensure_self_profile(db, user, role_code)
    hr = _hr_self(db, user)
    details = dict(profile.extra or {})
    if hr is not None:
        details.setdefault("dateOfBirth", hr.date_of_birth or "")
        details.setdefault("qualification", hr.qualification or "")
        details.setdefault("yearsOfExperience", hr.experience or "")
        if hr.address and "street" not in details:
            details["street"] = hr.address
    name = _join_name(profile.first_name, profile.middle_name, profile.last_name) or user.email
    department = (hr.department if hr and hr.department else details.get("department") or (campus.name if campus else ""))
    designation = (hr.designation if hr and hr.designation else (role.name if role else role_code))
    joining = (hr.joining_date if hr and hr.joining_date else details.get("joiningDate") or "")
    manager = (hr.reporting_manager if hr and hr.reporting_manager else details.get("reportingManager") or "")
    employment_type = (hr.employment_type if hr and hr.employment_type else details.get("employmentType") or "")
    status = (hr.status if hr and hr.status else ("Active" if user.is_active else "Inactive"))
    gender = profile.gender or (hr.gender if hr else "") or ""
    mobile = profile.mobile_number or (hr.phone if hr else "") or ""
    staff_code = profile.staff_code or (hr.employee_code if hr else None)
    db.commit()
    return {
        "id": user.id,
        "email": user.email,
        "role": role_code,
        "role_name": role.name if role else "",
        "campus": {
            "id": campus.id,
            "code": campus.code,
            "name": campus.name,
            "city": campus.city,
        }
        if campus
        else None,
        "permissions": permission_codes_for(db, user),
        "must_change_password": user.must_change_password,
        "is_active": user.is_active,
        "name": name,
        "staff_code": staff_code,
        "employee_code": staff_code,
        "department": department,
        "designation": designation,
        "profile": {
            "staffCode": staff_code,
            "name": name,
            "firstName": profile.first_name or "",
            "middleName": profile.middle_name or "",
            "lastName": profile.last_name or "",
            "gender": gender,
            "mobileNumber": mobile,
            "department": department,
            "designation": designation,
            "joiningDate": joining or "",
            "reportingManager": manager or "",
            "employmentType": employment_type or "",
            "status": status,
            "details": details,
        },
    }


def update_me_profile(db: Session, user: User, changes: dict) -> dict:
    """Self-service update of own staff profile (name, gender, mobile, detail fields)."""
    from app.services.admin_users import DETAIL_FIELDS, _clean_details, _clean_text
    from app.services.audit import write_audit

    role = db.get(Role, user.role_id)
    role_code = role.code if role else ""
    profile = _ensure_self_profile(db, user, role_code)
    if "firstName" in changes and changes["firstName"] is not None:
        profile.first_name = _clean_text(changes["firstName"]) or profile.first_name
    if "middleName" in changes and changes["middleName"] is not None:
        profile.middle_name = _clean_text(changes["middleName"])
    if "lastName" in changes and changes["lastName"] is not None:
        profile.last_name = _clean_text(changes["lastName"])
    if "gender" in changes and changes["gender"] is not None:
        profile.gender = _clean_text(changes["gender"])[:24]
    if "mobileNumber" in changes and changes["mobileNumber"] is not None:
        profile.mobile_number = _clean_text(changes["mobileNumber"])[:32]
    if isinstance(changes.get("details"), dict):
        merged = dict(profile.extra or {})
        cleaned = _clean_details(changes["details"])
        # Also accept a few profile-page aliases that map into DETAIL_FIELDS / free text.
        aliases = {
            "personalEmail": "personalEmail",
            "emergencyContact": "familyContactNumber",
            "languages": "languages",
            "nationality": "nationality",
            "currentAddress": "currentAddress",
            "permanentAddress": "permanentAddress",
            "department": "department",
            "reportingManager": "reportingManager",
            "employmentType": "employmentType",
        }
        for src, dest in aliases.items():
            if src in changes["details"] and changes["details"][src] is not None:
                text = _clean_text(changes["details"][src])
                if text:
                    cleaned[dest] = text
                elif dest in merged:
                    merged.pop(dest, None)
        for key in DETAIL_FIELDS:
            if key in cleaned:
                merged[key] = cleaned[key]
            elif key in changes["details"] and not _clean_text(changes["details"].get(key)):
                merged.pop(key, None)
        for key, value in cleaned.items():
            if key not in DETAIL_FIELDS:
                merged[key] = value
        profile.extra = merged
    write_audit(
        db,
        action="PROFILE_UPDATED",
        entity_type="user",
        entity_id=str(user.id),
        actor_id=user.id,
        campus_id=user.campus_id,
        details="self",
    )
    db.commit()
    return me_payload(db, user)


def _token_payload(db: Session, user: User) -> dict:
    role = role_code_for(db, user)
    return {
        "access_token": create_access_token(user_id=str(user.id), role=role),
        "token_type": "bearer",
        "role": role,
        "must_change_password": user.must_change_password,
    }
