import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { FeedbackState } from '../../../Common/ui'
import {
    allNocsCleared,
    approveTcRequest,
    CLIENT_TC_WORKFLOW_STEPS,
    displayTcStatus,
    getTcRequestById,
    rejectTcRequest,
    statusBadgeColor,
    TC_STATUS_LABELS,
} from '../../../Common/TcRequest/tcRequestData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    advanceTcRequest,
    decideTcRequest,
    getTcRequest,
    updateTcNoc,
} from '../../../services/api/tcApiService'

const Section = ({ title, children }) => (
    <div className='bg-white rounded-2xl shadow-md p-4'>
        <h2 className='text-xl font-semibold text-black mb-6'>{title}</h2>
        {children}
    </div>
)

const Field = ({ label, value }) => (
    <div className='flex flex-col gap-y-1'>
        <span className='text-base font-medium text-[#808080]'>{label}</span>
        <span className='text-sm text-[#1E1E1E] whitespace-pre-wrap wrap-break-word'>{value || '—'}</span>
    </div>
)

const ViewTcRequestApproval = () => {
    const live = isLiveApiEnabled()
    const { id } = useParams()
    const navigate = useNavigate()
    const [request, setRequest] = useState(() => (live ? null : getTcRequestById(id)))
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [superAdminRemarks, setSuperAdminRemarks] = useState('')

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            const item = getTcRequestById(id)
            setRequest(item)
            setSuperAdminRemarks(item?.superAdminRemarks ?? '')
            setLoading(false)
            setError('')
            return
        }
        let cancelled = false
        ;(async () => {
            setLoading(true)
            setError('')
            const res = await getTcRequest(id)
            if (cancelled) return
            setLoading(false)
            if (!res.success) {
                setRequest(null)
                setError(typeof res.error === 'string' ? res.error : 'TC request was not found on the server.')
                return
            }
            setRequest(res.data)
            setSuperAdminRemarks(res.data?.superAdminRemarks ?? '')
        })()
        return () => { cancelled = true }
    }, [id])

    const handleApprove = async () => {
        if (!live && request && !allNocsCleared(request)) {
            toast.error('Clear all department NOCs before MD final approval (client TC workflow).')
            return
        }
        if (isLiveApiEnabled()) {
            setSaving(true)
            const res = await decideTcRequest(id, {
                decision: 'approve',
                remarks: superAdminRemarks || 'MD final approval after departmental NOCs.',
            })
            setSaving(false)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Could not approve TC on the server.')
                return
            }
            setRequest(res.data)
            toast.success('TC approved (MD final step on live API).')
            return
        }
        try {
            const updated = approveTcRequest(id, superAdminRemarks)
            if (updated) {
                setRequest(updated)
                toast.success('TC issued after MD final approval.')
            }
        } catch (err) {
            toast.error(err?.message || 'Could not approve TC.')
        }
    }

    const handleReject = async () => {
        if (isLiveApiEnabled()) {
            setSaving(true)
            const res = await decideTcRequest(id, { decision: 'reject', remarks: superAdminRemarks })
            setSaving(false)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Could not reject TC on the server.')
                return
            }
            setRequest(res.data)
            toast.success('TC request rejected on the server.')
            return
        }
        const updated = rejectTcRequest(id, superAdminRemarks, 'admin')
        if (updated) setRequest(updated)
    }

    return (
        <section className='space-y-6'>
            <button type='button' onClick={() => navigate('/admin/tc-request-approval')} className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer'>
                <ArrowLeft size={18} />
                Back to list
            </button>

            {live ? (
                <div className='rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3'>
                    <p className='text-xs font-semibold uppercase tracking-wide text-emerald-800'>
                        Live TC decision · GET/POST /api/v1/tc-requests/&#123;ref&#125;
                    </p>
                </div>
            ) : null}

            {loading ? (
                <FeedbackState kind='loading' title='Loading TC request' description='Fetching from the TC API…' />
            ) : !request ? (
                <div className='bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]'>{error || 'TC request not found.'}</div>
            ) : (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <div className='flex flex-wrap items-center gap-3'>
                            <h1 className='text-2xl font-semibold text-black'>{request.requestId}</h1>
                            <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${statusBadgeColor[request.status] || 'bg-slate-100 text-slate-700'}`}>
                                {displayTcStatus(request.status)}
                            </span>
                        </div>
                        <p className='text-sm text-[#667085] mt-2'>
                            MD final approval (client TC overflow) · {request.studentName} · {request.classSection}
                        </p>
                    </div>

                    <Section title='Client TC workflow'>
                        <ol className='grid gap-2 text-sm text-slate-700'>
                            {CLIENT_TC_WORKFLOW_STEPS.map((step, index) => {
                                const stage = String(request.workflowStage || '').toLowerCase()
                                const active = stage === step.key
                                  || (step.key === 'class_teacher' && stage === 'prm')
                                  || (step.key === 'md' && request.status === 'Pending Super Admin Approval')
                                return (
                                <li key={step.key} className={`flex gap-2 rounded-lg px-2 py-1 ${active ? 'bg-indigo-50 font-semibold text-indigo-900' : ''}`}>
                                    <span className='font-semibold text-slate-500'>{index + 1}.</span>
                                    <span>{step.label}{active ? ' · current' : ''}</span>
                                </li>
                                )
                            })}
                        </ol>
                        <p className='mt-3 text-xs text-slate-500'>
                            Live stages via workflowStage ({request.workflowStage || '—'}). Status: {TC_STATUS_LABELS[request.status] || request.status}.
                        </p>
                        {live && request.status !== 'Approved' && request.status !== 'Rejected' && request.workflowStage !== 'md' ? (
                            <button
                                type='button'
                                disabled={saving}
                                onClick={async () => {
                                    setSaving(true)
                                    const res = await advanceTcRequest(request.requestId || id, superAdminRemarks || 'Stage advanced')
                                    setSaving(false)
                                    if (!res.success) {
                                        toast.error(typeof res.error === 'string' ? res.error : 'Could not advance TC stage.')
                                        return
                                    }
                                    setRequest(res.data)
                                    toast.success(`Advanced to ${res.data.workflowStage || 'next stage'}.`)
                                }}
                                className='mt-3 min-h-10 rounded-md border border-[#515DEF] px-4 text-sm font-semibold text-[#515DEF] disabled:opacity-50'
                            >
                                Advance next stage (CT→…→NOC→MD)
                            </button>
                        ) : null}
                    </Section>

                    <Section title='Request Summary'>
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                            <Field label='Student Name' value={request.studentName} />
                            <Field label='Admission Number' value={request.admissionNumber} />
                            <Field label='Requested By' value={request.requestedBy} />
                            <Field label='Transfer To' value={request.transferTo} />
                            <Field label='Last Date of Attendance' value={request.lastDateOfAttendance} />
                            <Field label='PRM Forwarded On' value={request.forwardedOn} />
                            <div className='lg:col-span-3'><Field label='Reason' value={request.reason} /></div>
                            <div className='lg:col-span-3'><Field label='PRM Remarks' value={request.prmRemarks} /></div>
                        </div>
                    </Section>

                    {(request.nocClearances || []).length > 0 ? (
                    <Section title='Manager-Level NOC Clearance (Mandatory Departmental Sign-offs)'>
                        <div className='overflow-x-auto'>
                            <table className='w-full text-left text-xs'>
                                <thead>
                                    <tr className='border-b border-slate-100 bg-[#EDEEF5] text-[#0C1E5B] font-semibold uppercase'>
                                        <th className='py-3 px-4 rounded-s-lg'>Department</th>
                                        <th className='py-3 px-4'>Approving Manager</th>
                                        <th className='py-3 px-4'>Clearance Status</th>
                                        <th className='py-3 px-4'>Remarks & Audit Notes</th>
                                        <th className='py-3 px-4 rounded-e-lg'>Date Cleared</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-slate-100'>
                                    {(request.nocClearances || []).map((noc) => (
                                        <tr key={noc.departmentKey} className='hover:bg-slate-50/70 transition-colors'>
                                            <td className='py-3 px-4 font-bold text-slate-900'>{noc.department}</td>
                                            <td className='py-3 px-4 font-medium text-slate-700'>{noc.manager || '—'}</td>
                                            <td className='py-3 px-4'>
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                    noc.status === 'Cleared'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}>
                                                    <CheckCircle2 size={12} />
                                                    {noc.status}
                                                </span>
                                            </td>
                                            <td className='py-3 px-4 text-slate-600'>{noc.remarks || '—'}</td>
                                            <td className='py-3 px-4 text-slate-600'>
                                                {noc.clearedOn || noc.date || '—'}
                                                {live && noc.status !== 'Cleared' ? (
                                                    <button
                                                        type='button'
                                                        disabled={saving}
                                                        className='ml-2 text-[11px] font-semibold text-[#515DEF] hover:underline disabled:opacity-50'
                                                        onClick={async () => {
                                                            setSaving(true)
                                                            const res = await updateTcNoc(request.requestId || id, {
                                                                departmentKey: noc.departmentKey,
                                                                status: 'Cleared',
                                                                remarks: 'Cleared from MD/Admin console',
                                                            })
                                                            setSaving(false)
                                                            if (!res.success) {
                                                                toast.error(typeof res.error === 'string' ? res.error : 'NOC update failed.')
                                                                return
                                                            }
                                                            setRequest(res.data)
                                                            toast.success(`${noc.department} NOC cleared.`)
                                                        }}
                                                    >
                                                        Clear
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Section>
                    ) : null}

                    {request.status === 'Pending Super Admin Approval' ? (
                        <Section title='MD final decision (after dept NOCs)'>
                            {!live && !allNocsCleared(request) ? (
                                <p className='mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
                                    All department NOCs must be Cleared before MD final approval.
                                </p>
                            ) : null}
                            <label className='grid gap-2 text-sm font-medium text-[#808080]'>
                                Remarks
                                <textarea
                                    rows={4}
                                    value={superAdminRemarks}
                                    onChange={(event) => setSuperAdminRemarks(event.target.value)}
                                    className='w-full border border-[#D9D9D9] rounded-md px-3 py-2 text-sm text-[#1E1E1E]'
                                    placeholder='MD approval or rejection remarks…'
                                />
                            </label>
                            <div className='mt-4 flex flex-wrap gap-2'>
                                <button
                                    type='button'
                                    disabled={saving}
                                    onClick={handleReject}
                                    className='min-h-10 rounded-md border border-red-500 px-4 text-sm font-semibold text-red-600 disabled:opacity-50'
                                >
                                    Reject
                                </button>
                                <button
                                    type='button'
                                    disabled={saving || (!live && !allNocsCleared(request))}
                                    onClick={handleApprove}
                                    className='min-h-10 rounded-md bg-[#515DEF] px-4 text-sm font-semibold text-white disabled:opacity-50'
                                >
                                    MD approve &amp; issue TC
                                </button>
                            </div>
                        </Section>
                    ) : (
                        <Section title='Decision'>
                            <Field label='Status' value={request.status} />
                            <Field label='Remarks' value={request.superAdminRemarks} />
                            <Field label='TC Number' value={request.tcNumber} />
                        </Section>
                    )}
                </>
            )}
        </section>
    )
}

export default ViewTcRequestApproval
