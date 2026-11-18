import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ConfirmAction, DataTable, FeedbackState } from '../../../Common/ui'
import { EMPLOYEE_CATEGORIES } from '../domain/hrStatus'
import { employeeName, getEmployees, getLeaveBundle, nextId, pushNotification, saveLeaveBundle } from '../domain/hrStore'
import { Badge, Modal, PageIntro, PrimaryButton, Select, TableWrap, inputClass } from '../components/HrUi'
import { useHrTick } from '../components/hrUiState'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    getHrLeaveBundle,
    saveHrLeaveBundle,
    listPortalEmployees,
    patchHrItem,
} from '../../../services/api/hrApiService'

const LeaveManagement = () => {
    const policiesMode = useLocation().pathname.includes('policies')
    const live = isLiveApiEnabled()
    const tick = useHrTick()
    const [status, setStatus] = useState('')
    const [form, setForm] = useState(null)
    const [decisionCandidate, setDecisionCandidate] = useState(null)
    const [bundle, setBundle] = useState(() => (live ? { policies: [], requests: [], balances: [] } : getLeaveBundle()))
    const [employees, setEmployees] = useState(() => (live ? [] : getEmployees()))
    const [listLoading, setListLoading] = useState(Boolean(live))
    const [listError, setListError] = useState('')
    const [listSource, setListSource] = useState(live ? 'backend' : 'local')
    const [saving, setSaving] = useState(false)
    const [refreshNonce, setRefreshNonce] = useState(0)

    const loadLocal = useCallback(() => {
        void tick
        setBundle(getLeaveBundle())
        setEmployees(getEmployees())
        setListSource('local')
        setListError('')
        setListLoading(false)
    }, [tick])

    const loadLive = useCallback(async () => {
        setListLoading(true)
        setListError('')
        const [leaveRes, empRes] = await Promise.all([getHrLeaveBundle(), listPortalEmployees()])
        setListLoading(false)
        if (!leaveRes.success) {
            setListSource('error')
            setListError(typeof leaveRes.error === 'string' ? leaveRes.error : 'Failed to load leave from the API.')
            setBundle({ policies: [], requests: [], balances: [] })
            setEmployees([])
            return
        }
        setBundle(leaveRes.data || { policies: [], requests: [], balances: [] })
        setEmployees(empRes.success && Array.isArray(empRes.data) ? empRes.data : [])
        setListSource('backend')
    }, [])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            loadLocal()
            return
        }
        loadLive()
    }, [loadLive, loadLocal, refreshNonce])

    const nameFor = useCallback((id) => {
        const hit = employees.find((item) => item.id === id)
        return hit?.name || employeeName(id)
    }, [employees])

    const requests = useMemo(
        () => (bundle.requests || []).filter((item) => !status || item.status === status),
        [bundle.requests, status],
    )

    const decide = async (request, next) => {
        if (isLiveApiEnabled()) {
            setSaving(true)
            const patched = await patchHrItem('leave-requests', request.id, {
                status: next,
                approvedBy: next === 'Approved' ? 'HR' : request.approvedBy || '',
            })
            if (!patched.success) {
                setSaving(false)
                toast.error(typeof patched.error === 'string' ? patched.error : 'Server rejected the leave decision.')
                return
            }
            // Refresh full bundle so attendance side-effects from the API are visible next load.
            const refreshed = await getHrLeaveBundle()
            setSaving(false)
            if (refreshed.success) setBundle(refreshed.data)
            else setRefreshNonce((n) => n + 1)
            toast.success(`Leave ${next.toLowerCase()} on server.`)
            setDecisionCandidate(null)
            return
        }
        const requestsNext = getLeaveBundle().requests.map((item) => (
            item.id === request.id
                ? { ...item, status: next, approvedBy: next === 'Approved' ? 'Reporting Manager' : item.approvedBy }
                : item
        ))
        saveLeaveBundle({ ...getLeaveBundle(), requests: requestsNext })
        if (next === 'Pending') {
            pushNotification({
                type: 'Leave',
                title: 'Leave Approval Pending',
                message: `${employeeName(request.employeeId)} requested ${request.leaveType}.`,
                relatedDate: request.fromDate,
            })
        }
        toast.success(`Leave ${next.toLowerCase()}.`)
        setDecisionCandidate(null)
    }

    const savePolicy = async (event) => {
        event.preventDefault()
        if (!form.name || !(Number(form.entitlement) >= 0)) return toast.error('Policy name and entitlement are required.')
        const policy = {
            ...form,
            id: form.id || nextId('POL', bundle.policies),
            entitlement: Number(form.entitlement),
            maxConsecutive: Number(form.maxConsecutive) || 1,
            carryForward: form.carryForward === true || form.carryForward === 'true',
            paid: true,
            approvalRequired: true,
            active: true,
        }
        const policies = form.id
            ? (bundle.policies || []).map((row) => (row.id === form.id ? policy : row))
            : [policy, ...(bundle.policies || [])]

        if (isLiveApiEnabled()) {
            setSaving(true)
            const res = await saveHrLeaveBundle({ policies, requests: bundle.requests || [] })
            setSaving(false)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Server rejected the leave policy save.')
                return
            }
            setBundle(res.data)
            toast.success('Leave policy saved on server.')
            setForm(null)
            return
        }
        saveLeaveBundle({ ...getLeaveBundle(), policies })
        toast.success('Leave policy saved.')
        setForm(null)
    }

    const saveRequest = async (event) => {
        event.preventDefault()
        if (!form.employeeId || !form.fromDate) return toast.error('Employee and dates are required.')
        const record = {
            id: form.id || nextId('LVE', bundle.requests),
            ...form,
            days: Number(form.days) || 1,
            status: form.status || 'Pending',
            approvedBy: form.approvedBy || '',
        }
        const requestsNext = form.id
            ? (bundle.requests || []).map((row) => (row.id === form.id ? record : row))
            : [record, ...(bundle.requests || [])]

        if (isLiveApiEnabled()) {
            setSaving(true)
            const res = await saveHrLeaveBundle({ policies: bundle.policies || [], requests: requestsNext })
            setSaving(false)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Server rejected the leave request.')
                return
            }
            setBundle(res.data)
            toast.success('Leave request saved on server.')
            setForm(null)
            return
        }
        saveLeaveBundle({ ...getLeaveBundle(), requests: requestsNext })
        pushNotification({
            type: 'Leave',
            title: 'Leave Approval Pending',
            message: `${employeeName(form.employeeId)} submitted ${form.leaveType}.`,
            relatedDate: form.fromDate,
        })
        toast.success('Leave request submitted for manager approval.')
        setForm(null)
    }

    const policyRows = (bundle.policies || []).map((row) => {
        const entitlement = Number(row.entitlement || 0)
        const term = Math.floor(entitlement / 3)
        const used = (bundle.requests || [])
            .filter((item) => item.leaveType === row.leaveType && item.status === 'Approved')
            .reduce((sum, item) => sum + (Number(item.days) || 0), 0)
        return {
            ...row,
            entitlement,
            termAllocation: `${term} / ${term} / ${entitlement - (term * 2)}`,
            used,
            balance: Math.max(0, entitlement - used),
        }
    })
    const policyColumns = [
        { key: 'name', label: 'Policy', required: true },
        { key: 'category', label: 'Category' },
        { key: 'leaveType', label: 'Type', required: true },
        { key: 'entitlement', label: 'Year entitlement' },
        { key: 'termAllocation', label: 'Term 1 / 2 / 3' },
        { key: 'used', label: 'Used' },
        { key: 'balance', label: 'Balance' },
        { key: 'carryForward', label: 'Carry forward', render: (row) => (row.carryForward ? 'Yes' : 'No') },
        { key: 'maxConsecutive', label: 'Max days' },
    ]
    const requestColumns = [
        { key: 'employeeId', label: 'Employee', required: true, render: (row) => nameFor(row.employeeId) },
        { key: 'leaveType', label: 'Type', required: true },
        { key: 'dates', label: 'Dates', render: (row) => `${row.fromDate || '—'} – ${row.toDate || '—'}` },
        { key: 'reason', label: 'Reason' },
        { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
    ]

    return (
        <section>
            <PageIntro text='Leave requests move from employee submission to manager decision and stay visible to HR for attendance and payroll.'>
                {!policiesMode && <Select label='Status' value={status} onChange={(e) => setStatus(e.target.value)} options={['Pending', 'Approved', 'Rejected']} />}
            </PageIntro>
            {live ? (
                <FeedbackState
                    tone={listSource === 'error' ? 'danger' : 'info'}
                    title={listSource === 'error' ? 'Leave API unavailable' : 'Live HR leave'}
                    description={
                        listSource === 'error'
                            ? listError
                            : 'Policies and HR leave ledger load from GET/PUT /api/v1/hr/leave. Formal staff approval chains also use /api/v1/leave-requests (Received Leave).'
                    }
                />
            ) : null}
            {listLoading ? <p className='text-sm text-slate-500 py-6'>Loading leave data…</p> : null}
            {listError && !listLoading ? (
                <button type='button' className='mb-3 text-sm font-semibold text-[#515DEF]' onClick={() => setRefreshNonce((n) => n + 1)}>
                    Retry
                </button>
            ) : null}
            {!listLoading && policiesMode ? (
                <TableWrap title='Leave Policies' action={<PrimaryButton disabled={saving} onClick={() => setForm({ name: '', category: 'Academics', leaveType: 'Casual Leave', entitlement: 12, maxConsecutive: 3, carryForward: false })}>Add Policy</PrimaryButton>}>
                    <DataTable caption='Leave policy register' rows={policyRows} columns={policyColumns} rowKey='id' emptyTitle='No leave policies configured' emptyDescription='Create a policy to define entitlement and carry-forward rules.' />
                </TableWrap>
            ) : null}
            {!listLoading && !policiesMode ? (
                <TableWrap title='Leave Requests' action={<PrimaryButton disabled={saving || !employees[0]} onClick={() => employees[0] && setForm({ employeeId: employees[0].id, leaveType: 'Casual Leave', fromDate: '2026-09-28', toDate: '2026-09-28', days: 1, reason: '' })}>Add Request</PrimaryButton>}>
                    <DataTable
                        caption='Leave request register'
                        rows={requests}
                        columns={requestColumns}
                        rowKey='id'
                        emptyTitle='No leave requests found'
                        emptyDescription='Change the status filter or submit a leave request.'
                        renderActions={(row) => (row.status === 'Pending' ? (
                            <>
                                <button type='button' className='min-h-9 rounded-md border border-[#039855] px-3 text-xs font-semibold text-[#027A48] hover:bg-[#ECFDF3]' onClick={() => setDecisionCandidate({ request: row, next: 'Approved' })}>Approve</button>
                                <button type='button' className='min-h-9 rounded-md border border-[#D92D20] px-3 text-xs font-semibold text-[#B42318] hover:bg-[#FEF3F2]' onClick={() => setDecisionCandidate({ request: row, next: 'Rejected' })}>Reject</button>
                            </>
                        ) : null)}
                    />
                </TableWrap>
            ) : null}
            {form && (
                <Modal title={policiesMode ? 'Leave policy' : 'Leave request'} onClose={() => setForm(null)}>
                    <form onSubmit={policiesMode ? savePolicy : saveRequest} className='grid gap-3'>
                        {policiesMode ? (
                            <>
                                <input className={inputClass} placeholder='Policy name' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{[...new Set(['Academics', 'Admin', 'Support / Operations', ...EMPLOYEE_CATEGORIES])].map((item) => <option key={item}>{item}</option>)}</select>
                                <input className={inputClass} placeholder='Leave type' value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })} />
                                <input className={inputClass} type='number' placeholder='Entitlement' value={form.entitlement} onChange={(e) => setForm({ ...form, entitlement: e.target.value })} />
                            </>
                        ) : (
                            <>
                                <select className={inputClass} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>{employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                                <input className={inputClass} value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })} />
                                <input className={inputClass} value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
                                <input className={inputClass} value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
                                <input className={inputClass} placeholder='Reason' value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                            </>
                        )}
                        <PrimaryButton type='submit' disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>
                    </form>
                </Modal>
            )}
            <ConfirmAction
                open={Boolean(decisionCandidate)}
                onClose={() => setDecisionCandidate(null)}
                onConfirm={() => decisionCandidate && decide(decisionCandidate.request, decisionCandidate.next)}
                title={`${decisionCandidate?.next === 'Approved' ? 'Approve' : 'Reject'} leave request?`}
                description='Review the employee, leave type, dates, and reason before recording this decision.'
                confirmLabel={decisionCandidate?.next === 'Approved' ? 'Approve request' : 'Reject request'}
                tone={decisionCandidate?.next === 'Rejected' ? 'danger' : 'primary'}
                confirmDisabled={saving}
            >
                <p><strong>{decisionCandidate ? nameFor(decisionCandidate.request.employeeId) : ''}</strong> · {decisionCandidate?.request.leaveType} · {decisionCandidate?.request.fromDate} to {decisionCandidate?.request.toDate}.</p>
            </ConfirmAction>
        </section>
    )
}

export default LeaveManagement
