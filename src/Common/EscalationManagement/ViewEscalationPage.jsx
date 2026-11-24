import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import ConfirmAction from '../ui/ConfirmAction'
import FeedbackState from '../ui/FeedbackState'
import FormField from '../ui/FormField'
import IntegrationNotice from '../ui/IntegrationNotice'
import PageHeader from '../ui/PageHeader'
import StatusBadge from '../ui/StatusBadge'
import Surface from '../ui/Surface'
import WorkflowContextBar from '../ui/WorkflowContextBar'
import WorkflowTimeline from '../ui/WorkflowTimeline'
import { buildWorkflowEvents, getWorkflowState } from '../ui/workflow'
import EscalationForm from './Components/EscalationForm'
import {
    formatDateTime,
    getEscalationById,
    getResolveByDate,
    isReceivedEscalation,
    RECEIVED_RESOLUTION_STATUSES,
    RESOLUTION_SLA_HOURS,
    updateEscalation,
} from './escalationData'
import { getRoleConfig } from './escalationRoleConfig'
import { formatEscalatedToDisplay } from './escalationUsersData'
import { useEscalationContext } from './useEscalationContext'
import { isLiveApiEnabled } from '../../services/api/tokenStore'
import {
    getEscalation,
    setEscalationStatus,
} from '../../services/api/escalationApiService'

const Field = ({ label, value }) => (
    <div>
        <dt className='text-xs font-medium text-[var(--erp-muted)]'>{label}</dt>
        <dd className='mt-1 whitespace-pre-wrap break-words text-sm font-medium text-[var(--erp-ink)]'>{value || '—'}</dd>
    </div>
)

const ViewEscalationPage = ({ roleKey }) => {
    const live = isLiveApiEnabled()
    const navigate = useNavigate()
    const { id } = useParams()
    const location = useLocation()
    const pathnameRole = location.pathname.startsWith('/parent') ? 'parent' : (location.pathname.startsWith('/student') ? 'student' : null)
    const effectiveRoleKey = (roleKey === 'student' && pathnameRole) ? pathnameRole : (roleKey || pathnameRole || 'teacher')
    const roleConfig = getRoleConfig(effectiveRoleKey)
    const { currentUser } = useEscalationContext(effectiveRoleKey)
    const [revision, setRevision] = useState(0)
    const [escalation, setEscalation] = useState(() => (live ? null : getEscalationById(effectiveRoleKey, id)))
    const [loading, setLoading] = useState(Boolean(live))
    const [loadError, setLoadError] = useState('')
    const [saving, setSaving] = useState(false)
    const [resolutionEdit, setResolutionEdit] = useState(() => {
        const current = live ? null : getEscalationById(effectiveRoleKey, id)
        return { recordId: id, status: current?.status || '', remarks: current?.resolutionRemarks || '' }
    })
    const [confirmOpen, setConfirmOpen] = useState(false)
    const resolutionDraft = resolutionEdit.recordId === id ? resolutionEdit.status : (escalation?.status || '')
    const resolutionRemarks = resolutionEdit.recordId === id ? resolutionEdit.remarks : (escalation?.resolutionRemarks || '')

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            const local = getEscalationById(effectiveRoleKey, id)
            setEscalation(local)
            setLoading(false)
            setLoadError('')
            setResolutionEdit({
                recordId: id,
                status: local?.status || '',
                remarks: local?.resolutionRemarks || '',
            })
            return undefined
        }
        let cancelled = false
        ;(async () => {
            setLoading(true)
            setLoadError('')
            const res = await getEscalation(id)
            if (cancelled) return
            setLoading(false)
            if (!res.success) {
                setEscalation(null)
                setLoadError(typeof res.error === 'string' ? res.error : 'Escalation was not found on the server.')
                return
            }
            setEscalation(res.data)
            setResolutionEdit({
                recordId: id,
                status: res.data?.status || '',
                remarks: res.data?.resolutionRemarks || '',
            })
        })()
        return () => { cancelled = true }
    }, [id, revision, effectiveRoleKey, live])

    const isReceived = useMemo(() => {
        if (!escalation) return false
        if (isReceivedEscalation(escalation, effectiveRoleKey, currentUser)) return true
        // Live records may use backend role codes / email ownership.
        if (live || escalation.dataSource === 'backend') {
            const myEmail = String(currentUser?.email || '').trim().toLowerCase()
            const ownerEmail = String(escalation.escalatedToUserEmail || '').trim().toLowerCase()
            if (myEmail && ownerEmail && myEmail === ownerEmail) return true
            const raiserEmail = String(escalation.escalatedBy || '').trim().toLowerCase()
            if (myEmail && raiserEmail && myEmail === raiserEmail) return false
        }
        return false
    }, [escalation, effectiveRoleKey, currentUser, live])

    const resolveByDate = useMemo(() => {
        if (!escalation) return null
        if (escalation.resolveBy) {
            const parsed = new Date(escalation.resolveBy)
            if (!Number.isNaN(parsed.getTime())) return parsed
        }
        return getResolveByDate(escalation)
    }, [escalation])

    const commitResolution = async () => {
        const isTerminal = ['Resolved', 'Rejected'].includes(resolutionDraft)

        if (live || escalation?.dataSource === 'backend') {
            setSaving(true)
            const res = await setEscalationStatus(id, {
                status: resolutionDraft,
                note: resolutionRemarks.trim() || null,
            })
            setSaving(false)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'The escalation status could not be updated on the server.')
                return
            }
            setEscalation(res.data)
            setResolutionEdit({
                recordId: id,
                status: res.data?.status || resolutionDraft,
                remarks: res.data?.resolutionRemarks || resolutionRemarks.trim(),
            })
            setConfirmOpen(false)
            toast.success(`Escalation moved to ${resolutionDraft.toLowerCase()}.`)
            return
        }

        const updated = updateEscalation(effectiveRoleKey, id, {
            status: resolutionDraft,
            resolutionRemarks: resolutionRemarks.trim(),
            resolvedAt: isTerminal ? new Date().toISOString() : null,
        })
        if (!updated) {
            toast.error('The escalation status could not be updated.')
            return
        }
        setRevision((value) => value + 1)
        setResolutionEdit({ recordId: id, status: updated.status, remarks: updated.resolutionRemarks || '' })
        setConfirmOpen(false)
        toast.success(`Escalation moved to ${resolutionDraft.toLowerCase()}.`)
    }

    if (loading) {
        return (
            <section className='space-y-5'>
                <FeedbackState kind='loading' title='Loading escalation' description='Fetching this escalation from the server.' />
            </section>
        )
    }

    if (!escalation) {
        return (
            <section className='space-y-5'>
                <button type='button' onClick={() => navigate(roleConfig.routeBase)} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm font-semibold text-[var(--erp-ink)]'>
                    <ArrowLeft aria-hidden='true' size={17} /> Back to escalations
                </button>
                <FeedbackState kind='permission' title='Escalation unavailable' description={loadError || 'This escalation does not exist or is outside your role and user scope.'} />
            </section>
        )
    }

    const owner = formatEscalatedToDisplay(escalation)
    const workflowState = getWorkflowState(escalation.status, { dueAt: resolveByDate })
    const timelineEvents = buildWorkflowEvents({
        status: escalation.status,
        submittedLabel: 'Escalation raised',
        submittedBy: escalation.escalatedBy,
        submittedAt: escalation.escalatedAt || escalation.escalationDate,
        owner,
        remarks: escalation.resolutionRemarks,
        decisionAt: escalation.resolvedAt,
        dueAt: resolveByDate,
    })
    const nextAction = isReceived
        ? (workflowState.terminal ? 'Resolution complete' : 'Review and update resolution status')
        : (workflowState.terminal ? 'Review the recorded outcome' : `Await response from ${owner}`)

    return (
        <section className='space-y-5'>
            <PageHeader
                title={escalation.escalationId || escalation.id}
                description={isReceived ? `Raised by ${escalation.escalatedBy}` : `Sent to ${owner}`}
                status={workflowState.key}
                context={isReceived ? 'Received escalation' : 'Sent escalation'}
                meta={<StatusBadge status={escalation.status} label={`Recorded status: ${escalation.status}`} />}
                actions={(
                    <button type='button' onClick={() => navigate(roleConfig.routeBase)} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm font-semibold text-[var(--erp-ink)]'>
                        <ArrowLeft aria-hidden='true' size={17} /> Back to escalations
                    </button>
                )}
            />

            <IntegrationNotice
                state={live || escalation.dataSource === 'backend' ? 'connected' : 'mock'}
                title={live || escalation.dataSource === 'backend' ? 'Live escalation detail' : 'Browser mock escalation'}
                description={live || escalation.dataSource === 'backend'
                    ? 'Loaded from /api/v1/escalations/{id}. Status updates POST to /status.'
                    : 'Status changes are local to this browser.'}
            />

            <WorkflowContextBar
                owner={owner}
                due={resolveByDate ? formatDateTime(resolveByDate) : 'Not recorded'}
                priority={escalation.priority}
                nextAction={nextAction}
            />

            {workflowState.overdue && (
                <div role='alert' className='rounded-[var(--erp-radius-surface)] border border-[#F3B8C2] bg-[#FDECEF] px-4 py-3'>
                    <p className='text-sm font-semibold text-[#A51D35]'>Resolution overdue</p>
                    <p className='mt-0.5 text-sm text-[var(--erp-slate)]'>The {RESOLUTION_SLA_HOURS}-hour response window ended at {formatDateTime(resolveByDate)}.</p>
                </div>
            )}

            <div className='grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]'>
                <div className='space-y-5'>
                    {isReceived && !workflowState.terminal && (
                        <Surface title='Resolution action' description='Review the complete escalation before recording a status change.' contentClassName='p-4 sm:p-5'>
                            <div className='grid gap-4 sm:grid-cols-2'>
                                <FormField id='resolution-status' label='Resolution status' hint={`Resolve or reject within ${RESOLUTION_SLA_HOURS} hours.`} required>
                                    <select value={resolutionDraft} onChange={(event) => setResolutionEdit({ recordId: id, status: event.target.value, remarks: resolutionRemarks })} className='min-h-10 w-full rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm text-[var(--erp-ink)]'>
                                        {RECEIVED_RESOLUTION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                                    </select>
                                </FormField>
                                <FormField id='resolution-remarks' label='Resolution remarks' hint='Summarise what was checked and what happens next.'>
                                    <textarea rows={3} value={resolutionRemarks} onChange={(event) => setResolutionEdit({ recordId: id, status: resolutionDraft, remarks: event.target.value })} className='w-full rounded-lg border border-[var(--erp-line-strong)] px-3 py-2 text-sm text-[var(--erp-ink)]' />
                                </FormField>
                            </div>
                            <div className='mt-4 flex justify-end'>
                                <button type='button' onClick={() => setConfirmOpen(true)} disabled={saving || !resolutionDraft || resolutionDraft === escalation.status && resolutionRemarks.trim() === (escalation.resolutionRemarks || '')} className='min-h-10 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white disabled:opacity-50'>Review status update</button>
                            </div>
                        </Surface>
                    )}

                    <Surface title='Escalation information' contentClassName='p-4 sm:p-5'>
                        <dl className='grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'>
                            <Field label='Escalation date' value={escalation.escalationDate} />
                            <Field label='Escalated by' value={escalation.escalatedBy} />
                            <Field label='Sender role' value={escalation.escalatedByRole} />
                            <Field label='Escalated to' value={owner} />
                            <Field label='Resolution SLA' value={`${RESOLUTION_SLA_HOURS} hours`} />
                            <Field label='Resolve by' value={resolveByDate ? formatDateTime(resolveByDate) : '—'} />
                            {escalation.resolvedAt && <Field label='Resolved at' value={formatDateTime(escalation.resolvedAt)} />}
                            {escalation.resolutionRemarks && <div className='sm:col-span-2 lg:col-span-3'><Field label='Resolution remarks' value={escalation.resolutionRemarks} /></div>}
                        </dl>
                    </Surface>

                    <Surface title='Reported details' description='Original content supplied by the sender.' contentClassName='p-4 sm:p-5'>
                        <EscalationForm form={escalation} roleConfig={roleConfig} readOnly />
                    </Surface>
                </div>

                <WorkflowTimeline events={timelineEvents} description='Only timestamps stored with this escalation are shown.' />
            </div>

            {workflowState.terminal && (
                <IntegrationNotice
                    state='disconnected'
                    title='Reopen and complaint routing not connected'
                    description='The production API must validate reopen permissions, preserve the prior decision and create the next SLA-bound owner step.'
                />
            )}

            <ConfirmAction
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={commitResolution}
                title={`Move escalation to ${resolutionDraft}?`}
                description={live || escalation.dataSource === 'backend'
                    ? 'Confirm the new state before posting to /api/v1/escalations/{id}/status.'
                    : 'Confirm the new state before updating this browser-stored escalation.'}
                confirmLabel={saving ? 'Updating…' : 'Update status'}
                tone={resolutionDraft === 'Rejected' ? 'danger' : 'primary'}
            >
                <p>The recorded status will change from <strong>{escalation.status}</strong> to <strong>{resolutionDraft}</strong>.{live || escalation.dataSource === 'backend' ? '' : ' This action does not send a notification.'}</p>
            </ConfirmAction>
        </section>
    )
}

export default ViewEscalationPage
