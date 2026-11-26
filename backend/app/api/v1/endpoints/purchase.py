from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user
from app.models import User
from app.services import purchase as svc

router = APIRouter(prefix="/api/v1/purchase", tags=["purchase"])


@router.get("/requisitions")
def list_requisitions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    return svc.list_requisitions(db, user)


@router.post("/requisitions")
def create_requisition(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return svc.create_requisition(db, user, body)


@router.get("/quotes")
def list_quotes(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    return svc.list_quotes(db, user)


@router.post("/quotes")
def submit_quotes(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return svc.submit_quotes(db, user, body)


@router.get("/pos")
def list_pos(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    return svc.list_pos(db, user)


@router.get("/pos/{po_id}")
def get_po(
    po_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return svc.get_po(db, user, po_id)


@router.post("/pos")
def create_po(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return svc.create_po(db, user, body)


@router.post("/pos/{po_id}/approve")
def approve_po(
    po_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return svc.approve_po(db, user, po_id, body or {})


@router.get("/liabilities")
def list_liabilities(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    return svc.list_liabilities(db, user)


@router.post("/material-requests/decide")
def decide_material_request(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return svc.approve_material_request(db, user, body)
