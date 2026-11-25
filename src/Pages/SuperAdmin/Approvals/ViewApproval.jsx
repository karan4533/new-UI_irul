import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
    ConfirmAction,
    FeedbackState,
    PageHeader,
    StatusBadge,
    Surface,
    WorkflowTimeline,
} from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { decideApproval, getApproval } from '../../../services/api/approvalsApiService'
import {
    formatAmount,
    getApprovalRequestById,
    ROUTE_BASE,
    updateApprovalRequestStatus,
} from './approvalsData'

const Field = ({ label, value }) => (
    <div className='min-w-0'>
        <dt className='text-xs font-medium uppercase tracking-wide text-[var(--erp-muted)]'>{label}</dt>
        <dd className='mt-1 break-words text-sm text-[var(--erp-ink)]'>{value || '—'}</dd>
    </div>
)

const DetailGrid = ({ children }) => (
    <dl className='grid grid-cols-1 gap-5 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5'>{children}</dl>
)

const ViewApproval = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [request, setRequest] = useState(() => (live ? null : getApprovalRequestById(id)))
    const [remarks, setRemarks] = useState(() => (live ? '' : (getApprovalRequestById(id)?.superAdminRemarks ?? '')))
    const [pendingDecision, setPendingDecision] = useState('')
    const [saving, setSaving] = useState(false)
    const [validationMessage, setValidationMessage] = useState('')
    const [confirmationMessage, setConfirmationMessage] = useState('')
    const [loading, setLoading] = useState(Boolean(live))
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            const local = getApprovalRequestById(id)
            setRequest(local)
            setRemarks(local?.superAdminRemarks ?? '')
            setLoading(false)
            return
        }
        let cancelled = false
        ;(async () => {
            setLoading(true)
            const res = await getApproval(id)
            if (cancelled) return
            setLoading(false)
            if (!res.success) {
                setRequest(null)
                return
            }
            setRequest(res.data)
            setRemarks('')
        })()
        return () => { cancelled = true }
    }, [id])

    const loadDetail = useCallback(async () => {
        if (!live) {
            setLoading(false)
            setLoadError('Live API is disabled.')
            setRequest(null)
            return
        }
        setLoading(true)
        setLoadError('')
        const res = await getApprovalDetail(id)
        if (!res.success) {
            setRequest(null)
            setLoadError(res.error || 'Approval request not found.')
            setLoading(false)
            return
        }
        setRequest(res.data)
        setRemarks(res.data?.superAdminRemarks || '')
        setLoading(false)
    }, [id, live])

    useEffect(() => {
        loadDetail()
    }, [loadDetail])

    const timeline = useMemo(() => {
        if (!request) return []
        const events = Array.isArray(request.events) ? request.events : []
        if (events.length) {
            return events.map((event, index) => ({
                id: `${event.level}-${event.action}-${index}`,
                label: `${event.action} · level ${event.level}`,
                actor: event.actorRole || 'Approver',
                timestamp: event.at,
                description: event.comment || '',
                tone: event.action === 'denied' ? 'Rejected' : event.action === 'approved' ? 'Approved' : 'info',
                current: index === events.length - 1 && request.status === 'Pending',
            }))
        }
        return [
            {
                id: 'submitted',
                label: 'Submitted for approval',
                actor: `${request.requestedBy} · ${request.role}`,
                timestamp: request.createdAt,
                description: `${request.category} · entity ${request.entityId || request.requestId}`,
                tone: 'info',
            },
            request.status === 'Pending'
                ? {
                    id: 'pending',
                    label: `Awaiting ${request.awaitingRole || 'approver'}`,
                    actor: request.awaitingRole || 'Approver',
                    current: true,
                    description: 'Review the request context and record an accountable decision.',
                    tone: 'pending',
                }
                : {
                    id: 'decision',
                    label: request.status,
                    actor: 'Approver',
                    timestamp: request.updatedAt,
                    description: request.superAdminRemarks || 'Decision recorded on the server.',
                    tone: request.status,
                },
        ]
    }, [request])

    const beginDecision = (decision) => {
        if (decision === 'Rejected' && !remarks.trim()) {
            setValidationMessage('Rejection remarks are required so the requester knows what to correct.')
            return
        }
        setValidationMessage('')
        setPendingDecision(decision)
    }

    const confirmDecision = async () => {
        if (isLiveApiEnabled()) {
            setSaving(true)
            const res = await decideApproval(id, {
                decision: pendingDecision,
                comment: remarks.trim() || null,
            })
            setSaving(false)
            if (!res.success) {
                setValidationMessage(typeof res.error === 'string' ? res.error : 'Decision failed.')
                setPendingDecision('')
                return
            }
            setRequest(res.data)
            setConfirmationMessage(`Request was ${pendingDecision.toLowerCase()}.`)
            setPendingDecision('')
            return
        }
        const updated = updateApprovalRequestStatus(id, pendingDecision, remarks.trim())
        if (updated) {
            setRequest(updated)
            setConfirmationMessage(`Request ${updated.requestId} was ${pendingDecision.toLowerCase()}.`)
        }
        setPendingDecision('')
        if (!res.success) {
            toast.error(res.error || 'Could not record decision on the server.')
            return
        }
        setRequest({
            ...res.data,
            superAdminRemarks: remarks.trim(),
        })
        setConfirmationMessage(`Request ${res.data?.requestId || request.requestId} was ${pendingDecision.toLowerCase()} on the server.`)
        toast.success(`Request ${pendingDecision.toLowerCase()} successfully.`)
    }

    if (!live) {
        return (
            <section className='space-y-5'>
                <button type='button' onClick={() => navigate(ROUTE_BASE)} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-4 text-sm font-semibold text-[var(--erp-ink)]'>
                    <ArrowLeft aria-hidden='true' size={17} /> Back to approvals
                </button>
                <FeedbackState kind='error' title='Live API required' description='Approval detail uses GET /api/v1/approvals/{id}.' />
            </section>
        )
    }

    if (loading) {
        return (
            <section className='space-y-5'>
                <button type='button' onClick={() => navigate(ROUTE_BASE)} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-4 text-sm font-semibold text-[var(--erp-ink)]'>
                    <ArrowLeft aria-hidden='true' size={17} /> Back to approvals
                </button>
                <p className='text-sm text-[var(--erp-muted)]'>Loading approval detail…</p>
            </section>
        )
    }

    if (loading) {
        return <FeedbackState kind='loading' title='Loading approval' description='Please wait…' />
    }

    if (!request) {
        return (
            <section className='space-y-5'>
                <button type='button' onClick={() => navigate(ROUTE_BASE)} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-4 text-sm font-semibold text-[var(--erp-ink)]'>
                    <ArrowLeft aria-hidden='true' size={17} /> Back to approvals
                </button>
                <FeedbackState kind='empty' title='Approval request not found' description='This request may no longer exist.' />
            </section>
        )
    }

    return (
        <section className='space-y-5'>
            <PageHeader
                title={request.title}
                description={`${request.requestId} · ${request.category}`}
                context={`${request.requestedBy} · ${request.department} · received ${request.requestDate}`}
                status={request.status}
                actions={(
                    <button type='button' onClick={() => navigate(ROUTE_BASE)} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-4 text-sm font-semibold text-[var(--erp-ink)]'>
                        <ArrowLeft aria-hidden='true' size={17} /> Back to approvals
                    </button>
                )}
            />

            {confirmationMessage && (
                <div role='status' className='rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'>
                    {confirmationMessage}
                </div>
            )}

            <div className='grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.75fr)]'>
                <div className='space-y-5'>
                    <Surface title='Request information' description='Verify the requester, ownership and workflow context before deciding.'>
                        <DetailGrid>
                            <Field label='Request ID' value={request.requestId} />
                            <Field label='Category' value={<StatusBadge status='info' label={request.category} />} />
                            <Field label='Priority' value={<StatusBadge status={request.priority === 'High' ? 'overdue' : 'info'} label={request.priority} />} />
                            <Field label='Requested by' value={request.requestedBy} />
                            <Field label='Role' value={request.role} />
                            <Field label='Department' value={request.department} />
                            <Field label='Awaiting' value={request.awaitingRole || request.requestedTo} />
                            <Field label='Amount' value={formatAmount(request.amount)} />
                            <Field label='Request date' value={request.requestDate} />
                            <div className='sm:col-span-2 lg:col-span-3'><Field label='Description' value={request.description} /></div>
                        </DetailGrid>
                    </Surface>
                </div>

                <div className='space-y-5'>
                    <WorkflowTimeline events={timeline} description='Server approval events when available.' />

                    {request.status === 'Pending' ? (
                        <Surface title='Record a decision' description='Remarks are mandatory for rejection and recommended for approval.' contentClassName='space-y-4 p-4 sm:p-5'>
                            <label className='grid gap-1.5 text-sm font-medium text-[var(--erp-ink)]' htmlFor='super-admin-remarks'>
                                Decision remarks
                                <textarea
                                    id='super-admin-remarks'
                                    rows={5}
                                    value={remarks}
                                    onChange={(event) => { setRemarks(event.target.value); setValidationMessage('') }}
                                    className='w-full rounded-lg border border-[var(--erp-line-strong)] px-3 py-2 text-sm font-normal'
                                    placeholder='State the reason, conditions or corrective action…'
                                />
                            </label>
                            {validationMessage && <p role='alert' className='text-sm font-medium text-[var(--erp-red)]'>{validationMessage}</p>}
                            <div className='grid gap-2 sm:grid-cols-2'>
                                <button type='button' disabled={saving} onClick={() => beginDecision('Rejected')} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--erp-red)] px-4 text-sm font-semibold text-[var(--erp-red)] disabled:opacity-60'>
                                    <XCircle aria-hidden='true' size={17} /> Reject
                                </button>
                                <button type='button' disabled={saving} onClick={() => beginDecision('Approved')} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white disabled:opacity-60'>
                                    <CheckCircle2 aria-hidden='true' size={17} /> Approve
                                </button>
                            </div>
                        </Surface>
                    ) : (
                        <Surface title='Decision record' contentClassName='p-4 sm:p-5'>
                            <Field label='Decision remarks' value={request.superAdminRemarks || 'No remarks recorded'} />
                        </Surface>
                    )}
                </div>
            </div>

            <ConfirmAction
                open={Boolean(pendingDecision)}
                onClose={() => !saving && setPendingDecision('')}
                onConfirm={confirmDecision}
                title={`${pendingDecision === 'Rejected' ? 'Reject' : 'Approve'} request?`}
                description='Confirm this decision for the selected request.'
                confirmLabel={pendingDecision === 'Rejected' ? 'Confirm rejection' : 'Confirm approval'}
                tone={pendingDecision === 'Rejected' ? 'danger' : 'primary'}
                busy={saving}
            >
                <p><strong>{request.requestId || request.id}</strong> will be marked <strong>{pendingDecision}</strong>.</p>
                {remarks.trim() && <p className='mt-2 rounded-md bg-[var(--erp-canvas)] p-2'>Remarks: {remarks.trim()}</p>}
            </ConfirmAction>
        </section>
    )
}

export default ViewApproval
