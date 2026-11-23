import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import ConfirmAction from '../ui/ConfirmAction'
import FeedbackState from '../ui/FeedbackState'
import FormField from '../ui/FormField'
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
import { useAuth } from '../../context/AuthContext'
import { isLiveApiEnabled } from '../../services/api/tokenStore'
import { getEscalation as getLiveEscalation, updateEscalationStatus } from '../../services/api/escalationApiService'

const LIVE_RESOLUTION_STATUSES = ['In Review', 'Resolved', 'Rejected']

const Field = ({ label, value }) => (
    <div>
        <dt className='text-xs font-medium text-[var(--erp-muted)]'>{label}</dt>
        <dd className='mt-1 whitespace-pre-wrap break-words text-sm font-medium text-[var(--erp-ink)]'>{value || '—'}</dd>
    </div>
)

const ViewEscalationPage = ({ roleKey }) => {
    const navigate = useNavigate()
    const { id } = useParams()
    const location = useLocation()
    const pathnameRole = location.pathname.startsWith('/parent') ? 'parent' : (location.pathname.startsWith('/student') ? 'student' : null)
    const effectiveRoleKey = (roleKey === 'student' && pathnameRole) ? pathnameRole : (roleKey || pathnameRole || 'teacher')
    const roleConfig = getRoleConfig(effectiveRoleKey)
    const { currentUser } = useEscalationContext(effectiveRoleKey)
    const live = isLiveApiEnabled()
    const { email: authEmail } = useAuth()
    const [revision, setRevision] = useState(0)
    const [liveRecord, setLiveRecord] = useState(null)
    const [liveLoading, setLiveLoading] = useState(live)
    const [liveError, setLiveError] = useState('')
    const [saving, setSaving] = useState(false)

    const loadLive = useCallback(async () => {
        setLiveLoading(true)
        setLiveError('')
        const res = await getLiveEscalation(id)
        setLiveLoading(false)
        if (!res.success) {
            setLiveRecord(null)
            setLiveError(typeof res.error === 'string' ? res.error : 'Failed to load this escalation.')
            return
        }
        setLiveRecord(res.data)
    }, [id])

    useEffect(() => {
        if (!live) return undefined
        const timer = setTimeout(() => { loadLive() }, 0)
        return () => clearTimeout(timer)
    }, [live, loadLive])

    const escalation = useMemo(() => {
        void revision
        if (live) return liveRecord
        return getEscalationById(effectiveRoleKey, id)
    }, [id, revision, effectiveRoleKey, live, liveRecord])
    const [resolutionEdit, setResolutionEdit] = useState(() => {
        const current = live ? null : getEscalationById(effectiveRoleKey, id)
        return { recordId: live ? '' : id, status: current?.status || '', remarks: current?.resolutionRemarks || '' }
    })
    const [confirmOpen, setConfirmOpen] = useState(false)
    const resolutionDraft = resolutionEdit.recordId === id ? resolutionEdit.status : (escalation?.status || '')
    const resolutionRemarks = resolutionEdit.recordId === id ? resolutionEdit.remarks : (escalation?.resolutionRemarks || '')

    const isReceived = useMemo(() => {
        if (!escalation) return false
        if (live) {
            const mine = String(escalation.escalatedByEmail || '').toLowerCase() === String(authEmail || '').toLowerCase()
            return !mine
        }
        return isReceivedEscalation(escalation, effectiveRoleKey, currentUser)
    }, [escalation, effectiveRoleKey, currentUser, live, authEmail])
    const isRaiser = live && Boolean(escalation) && !isReceived
    const statusOptions = live
        ? Array.from(new Set([escalation?.status, ...LIVE_RESOLUTION_STATUSES].filter((status) => status && status !== 'Closed')))
        : RECEIVED_RESOLUTION_STATUSES

    const resolveByDate = useMemo(
        () => (escalation ? getResolveByDate(escalation) : null),
        [escalation],
    )

    const commitLiveStatus = async (nextStatus, note) => {
        setSaving(true)
        const res = await updateEscalationStatus(id, nextStatus, note)
        setSaving(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'The escalation status could not be updated.')
            setConfirmOpen(false)
            return
        }
        setLiveRecord(res.data)
        setResolutionEdit({ recordId: id, status: res.data.status, remarks: res.data.resolutionRemarks || '' })
        setConfirmOpen(false)
        toast.success(`Escalation moved to ${nextStatus.toLowerCase()}.`)
    }

    const commitResolution = () => {
        if (live) {
            commitLiveStatus(resolutionDraft, resolutionRemarks)
            return
        }
        const isTerminal = ['Resolved', 'Rejected'].includes(resolutionDraft)
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

    if (live && liveLoading) {
        return <FeedbackState kind='loading' title='Loading escalation' description='Fetching escalation details…' />
    }

    if (live && liveError) {
        return (
            <section className='space-y-5'>
                <button type='button' onClick={() => navigate(roleConfig.routeBase)} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm font-semibold text-[var(--erp-ink)]'>
                    <ArrowLeft aria-hidden='true' size={17} /> Back to escalations
                </button>
                <FeedbackState kind='error' title='Escalations API unavailable' description={liveError} />
            </section>
        )
    }

    if (!escalation) {
        return (
            <section className='space-y-5'>
                <button type='button' onClick={() => navigate(roleConfig.routeBase)} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm font-semibold text-[var(--erp-ink)]'>
                    <ArrowLeft aria-hidden='true' size={17} /> Back to escalations
                </button>
                <FeedbackState kind='permission' title='Escalation unavailable' description='This escalation does not exist or is outside your role and user scope.' />
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
                title={escalation.displayId || escalation.id}
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
                                        {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                                    </select>
                                </FormField>
                                <FormField id='resolution-remarks' label='Resolution remarks' hint='Summarise what was checked and what happens next.'>
                                    <textarea rows={3} value={resolutionRemarks} onChange={(event) => setResolutionEdit({ recordId: id, status: resolutionDraft, remarks: event.target.value })} className='w-full rounded-lg border border-[var(--erp-line-strong)] px-3 py-2 text-sm text-[var(--erp-ink)]' />
                                </FormField>
                            </div>
                            <div className='mt-4 flex justify-end'>
                                <button type='button' onClick={() => setConfirmOpen(true)} disabled={!resolutionDraft || resolutionDraft === escalation.status && resolutionRemarks.trim() === (escalation.resolutionRemarks || '')} className='min-h-10 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white disabled:opacity-50'>Review status update</button>
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

            {isRaiser && ['Resolved', 'Rejected'].includes(escalation.status) && (
                <div className='flex justify-end'>
                    <button type='button' disabled={saving} onClick={() => commitLiveStatus('Closed', '')} className='min-h-10 rounded-lg bg-[var(--erp-ink)] px-4 text-sm font-semibold text-white disabled:opacity-50'>Close escalation</button>
                </div>
            )}

            <ConfirmAction
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={commitResolution}
                title={`Move escalation to ${resolutionDraft}?`}
                description='Confirm the new state before updating this escalation.'
                confirmLabel='Update status'
                tone={resolutionDraft === 'Rejected' ? 'danger' : 'primary'}
            >
                <p>The recorded status will change from <strong>{escalation.status}</strong> to <strong>{resolutionDraft}</strong>. The raiser is notified of the change.</p>
            </ConfirmAction>
        </section>
    )
}

export default ViewEscalationPage

