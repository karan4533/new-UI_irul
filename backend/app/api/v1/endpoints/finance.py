import logging

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_user, require_any, require_permission, role_code_for
from app.models import User
from app.services.errors import fail
from app.services import fee_reminders
from app.services import finance as svc
from app.services import finance_academic_fees as academic_fees
from app.services import finance_actions as actions
from app.services import finance_approval_limits as approval_limits
from app.services import finance_transport_fees as transport_fees
from app.services import finance_accounting
from app.services import finance_books
from app.services import finance_budget
from app.services import finance_reports
from app.services import finance_settings
from app.services import finance_vouchers
from app.services import finance_wallets

router = APIRouter(prefix="/api/v1/finance", tags=["finance"])

# Parents and students hold finance.read for /my-fees only; campus registers stay with staff.
_PORTAL_ROLES = {"parent", "student"}


def _campus_reader(*codes: str):
    permitted = require_any(*codes)

    def checker(user: User = Depends(permitted), db: Session = Depends(get_db)) -> User:
        if role_code_for(db, user) in _PORTAL_ROLES:
            fail(403, "forbidden", "Campus finance records are limited to staff.")
        return user

    return checker


_FINANCE_READ = ("finance.read", "finance.write", "finance.collect")


@router.get("/approval-limits")
def get_approval_limits(
    category: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return approval_limits.list_limits(db, user, category=category)


@router.put("/approval-limits")
def put_approval_limits(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("finance.write")),
) -> dict:
    return approval_limits.replace_limits(db, user, body)


@router.post("/approval-limits/evaluate")
def evaluate_approval_limits(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return approval_limits.evaluate_payload(db, user, body)


@router.get("/state")
def get_finance_state(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return svc.get_state(db, user)


@router.get("/my-fees")
def get_my_fees_route(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("finance.read")),
) -> dict:
    """Parent/student scoped fee ledger (children / self only)."""
    result = svc.get_my_fees(db, user)
    from app.deps import role_code_for

    if role_code_for(db, user) == "parent":
        try:
            fee_reminders.run_sweep(db, user.campus_id, student_ids=svc._child_student_ids_for_actor(db, user))
        except Exception:  # reminders must never break the fee page
            db.rollback()
            logging.getLogger(__name__).exception("Fee reminder sweep failed for a parent")
    return result


@router.put("/state")
def put_finance_state(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("finance.write")),
) -> dict:
    return svc.save_state(db, user, body)


@router.post("/state/reset")
def reset_finance_state(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("finance.write")),
) -> dict:
    return svc.reset_state(db, user)


@router.post("/actions/collect-payment")
def collect_payment_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.collect", "finance.write")),
) -> dict:
    return actions.collect_payment(db, user, body)


@router.post("/actions/pay-my-fees")
def pay_my_fees_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("finance.pay")),
) -> dict:
    """Parent/student online payment for linked children / self (scoped)."""
    return actions.pay_my_fees(db, user, body)


@router.post("/actions/settle-cheque")
def settle_cheque_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.collect", "finance.write")),
) -> dict:
    return actions.settle_cheque(db, user, body)


@router.post("/actions/send-receipt")
def send_receipt_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.collect", "finance.write")),
) -> dict:
    return actions.send_receipt(db, user, body)


@router.post("/actions/send-payment-link")
def send_payment_link_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.collect", "finance.write")),
) -> dict:
    return actions.send_payment_link(db, user, body)


@router.post("/actions/gateway-intent")
def gateway_intent_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.collect", "finance.write", "finance.pay")),
) -> dict:
    """Account Head desk (collect/write) + parent/student portal (finance.pay; scoped in service)."""
    return actions.create_gateway_intent(db, user, body)


@router.post("/actions/gateway-confirm")
def gateway_confirm_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.approve", "finance.write", "finance.collect", "finance.pay")),
) -> dict:
    """Verify Razorpay signature and settle fees. Portal uses finance.pay; desk uses collect/write/approve."""
    return actions.confirm_gateway_payment(db, user, body)


@router.post("/actions/reminder-sweep")
def reminder_sweep_route(
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.collect", "finance.write")),
) -> dict:
    """Send due in-app fee reminders to parents now (idempotent; see services/fee_reminders.py)."""
    return fee_reminders.run_sweep(db, user.campus_id)


@router.post("/actions/apply-hr-concessions")
def apply_hr_concessions_route(
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.approve", "finance.write")),
) -> dict:
    return actions.apply_hr_concessions(db, user)


@router.post("/actions/post-payroll-voucher")
def post_payroll_voucher_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write", "finance.approve", "hr.write")),
) -> dict:
    return actions.post_payroll_voucher(db, user, body)


@router.post("/actions/reverse-payroll-voucher")
def reverse_payroll_voucher_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.approve", "finance.write")),
) -> dict:
    return actions.reverse_payroll_voucher(db, user, body)


@router.get("/payroll-vouchers")
def list_payroll_vouchers_route(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader("finance.read", "finance.write", "finance.collect", "hr.read")),
) -> dict:
    return actions.list_payroll_vouchers(db, user)


@router.post("/actions/decide-approval")
def decide_approval_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.approve", "finance.write")),
) -> dict:
    return actions.decide_approval(db, user, body)


@router.post("/actions/post-transport-enrollment-fee")
def post_transport_enrollment_fee_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("ops.write", "finance.write")),
) -> dict:
    """Transport Manager enrollment → Fee Collection / Parent Academic Payment installments."""
    return actions.post_transport_enrollment_fee(db, user, body)


@router.get("/actions/transport-fees")
def list_transport_fees_route(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader("finance.read", "finance.write", "finance.collect", "ops.read", "ops.write")),
) -> dict:
    return transport_fees.list_transport_fees(db, user)


@router.post("/actions/upsert-transport-fee")
def upsert_transport_fee_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write", "ops.write")),
) -> dict:
    return transport_fees.upsert_transport_fee(db, user, body)


@router.post("/actions/assign-transport-fee")
def assign_transport_fee_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write", "ops.write", "finance.collect")),
) -> dict:
    return transport_fees.assign_transport_fee(db, user, body)


@router.post("/actions/collect-transport-fee")
def collect_transport_fee_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.collect", "finance.write")),
) -> dict:
    return transport_fees.collect_transport_fee(db, user, body)


@router.post("/actions/post-activity-enrollment-fee")
def post_activity_enrollment_fee_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("activities.write", "finance.write", "finance.collect")),
) -> dict:
    """Programme / activity enrollment → Fee Collection installments on the campus ledger."""
    return actions.post_activity_enrollment_fee(db, user, body)


@router.get("/actions/activity-fees")
def list_activity_fees_route(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader("finance.read", "finance.write", "finance.collect", "activities.read", "activities.write")),
) -> dict:
    return actions.list_activity_fees(db, user)


@router.post("/actions/upsert-activity-fee")
def upsert_activity_fee_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write", "activities.write")),
) -> dict:
    return actions.upsert_activity_fee(db, user, body)


@router.post("/actions/assign-activity-fee")
def assign_activity_fee_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write", "activities.write", "finance.collect")),
) -> dict:
    return actions.assign_activity_fee(db, user, body)


@router.post("/actions/update-activity-attendance")
def update_activity_attendance_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write", "activities.write", "finance.collect")),
) -> dict:
    return actions.update_activity_attendance(db, user, body)


@router.post("/actions/collect-activity-fee")
def collect_activity_fee_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.collect", "finance.write")),
) -> dict:
    return actions.collect_activity_fee(db, user, body)


@router.get("/actions/fee-structures")
def list_fee_structures_route(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return academic_fees.list_fee_structures(db, user)


@router.post("/actions/upsert-fee-structure")
def upsert_fee_structure_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write")),
) -> dict:
    return academic_fees.upsert_fee_structure(db, user, body)


@router.get("/actions/concessions")
def list_concessions_route(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return academic_fees.list_concessions(db, user)


@router.post("/actions/create-concession")
def create_concession_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write", "finance.collect")),
) -> dict:
    return academic_fees.create_concession(db, user, body)


@router.get("/actions/unpaid-installments")
def list_unpaid_installments_route(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return academic_fees.list_unpaid_installments(db, user)


@router.get("/actions/payment-vouchers")
def list_payment_vouchers_route(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return finance_vouchers.list_payment_vouchers(db, user)


@router.get("/actions/chart-of-accounts")
def list_chart_of_accounts_route(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return finance_accounting.list_chart_of_accounts(db, user)


@router.post("/actions/upsert-account")
def upsert_account_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write")),
) -> dict:
    return finance_accounting.upsert_account(db, user, body)


@router.get("/actions/journal-vouchers")
def list_journal_vouchers_route(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return finance_accounting.list_journal_vouchers(db, user)


@router.post("/actions/create-journal-voucher")
def create_journal_voucher_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write")),
) -> dict:
    return finance_accounting.create_journal_voucher(db, user, body)


@router.post("/actions/post-journal-voucher")
def post_journal_voucher_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write")),
) -> dict:
    return finance_accounting.post_journal_voucher(db, user, body)


@router.get("/actions/bank-reconciliation")
def list_bank_reconciliation_route(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return finance_accounting.list_reconciliation(db, user)


@router.post("/actions/reconcile-bank-entry")
def reconcile_bank_entry_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write")),
) -> dict:
    return finance_accounting.reconcile_entry(db, user, body)


@router.get("/actions/financial-statements")
def financial_statements_route(
    dateFrom: str | None = None,
    dateTo: str | None = None,
    department: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return finance_accounting.financial_statements(db, user, dateFrom, dateTo, department)


@router.get("/actions/wallets")
def list_wallets_route(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return finance_wallets.list_wallets(db, user)


@router.post("/actions/open-wallet")
def open_wallet_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write", "finance.collect")),
) -> dict:
    return finance_wallets.open_wallet(db, user, body)


@router.post("/actions/recharge-wallet")
def recharge_wallet_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write", "finance.collect")),
) -> dict:
    return finance_wallets.recharge_wallet(db, user, body)


@router.post("/actions/spend-wallet")
def spend_wallet_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write", "finance.collect")),
) -> dict:
    return finance_wallets.spend_from_wallet(db, user, body)


@router.post("/actions/set-wallet-status")
def set_wallet_status_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write")),
) -> dict:
    return finance_wallets.set_wallet_status(db, user, body)


@router.get("/actions/book-fees")
def list_book_fees_route(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return finance_books.list_book_fees(db, user)


@router.post("/actions/upsert-book-fee")
def upsert_book_fee_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write")),
) -> dict:
    return finance_books.upsert_book_fee_line(db, user, body)


@router.post("/actions/delete-book-fee")
def delete_book_fee_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write")),
) -> dict:
    return finance_books.delete_book_fee_line(db, user, body)


@router.get("/actions/annual-budget")
def list_budget_route(
    financialYear: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return finance_budget.list_budget(db, user, financialYear)


@router.post("/actions/upsert-budget-line")
def upsert_budget_line_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write")),
) -> dict:
    return finance_budget.upsert_budget_line(db, user, body)


@router.get("/actions/report-pack")
def report_pack_route(
    financialYear: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return finance_reports.report_pack(db, user, financialYear)


@router.get("/actions/finance-settings")
def get_finance_settings_route(
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> dict:
    return finance_settings.get_settings(db, user)


@router.post("/actions/update-finance-settings")
def update_finance_settings_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write")),
) -> dict:
    return finance_settings.update_settings(db, user, body)


@router.post("/actions/pay-vendor-liability")
def pay_vendor_liability_route(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_any("finance.write")),
) -> dict:
    return finance_vouchers.pay_vendor_liability(db, user, body)


@router.get("/{collection}")
def list_finance_collection(
    collection: str,
    db: Session = Depends(get_db),
    user: User = Depends(_campus_reader(*_FINANCE_READ)),
) -> list:
    return svc.list_collection(db, user, collection)


@router.put("/{collection}")
def replace_finance_collection(
    collection: str,
    body: list = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("finance.write")),
) -> list:
    return svc.replace_collection(db, user, collection, body)
