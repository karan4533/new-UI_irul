import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { FeedbackState } from '../../../Common/ui'
import {
    CLIENT_TC_WORKFLOW_STEPS,
    displayTcStatus,
    forwardTcRequestToSuperAdmin,
    getTcRequestById,
    isTcWorkflowStepCurrent,
    rejectTcRequest,
    resolveTcWorkflowStage,
    tcStatusBadgeClass,
} from '../../../Common/TcRequest/tcRequestData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    advanceTcRequest,
    forwardTcRequest,
    getTcRequest,
    rejectTcRequestAtPrm,
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

const ViewTcRequest = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [request, setRequest] = useState(() => (live ? null : getTcRequestById(id)))
    const [prmRemarks, setPrmRemarks] = useState('')
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    const loadLive = useCallback(async () => {
        setLoading(true)
        setError('')
        const res = await getTcRequest(id)
        setLoading(false)
        if (!res.success || !res.data) {
            setRequest(null)
            setError(typeof res.error === 'string' ? res.error : 'TC request not found on the server.')
            return
        }
        setRequest(res.data)
        setPrmRemarks(res.data.prmRemarks || '')
    }, [id])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            const local = getTcRequestById(id)
            setRequest(local)
            setPrmRemarks(local?.prmRemarks ?? '')
            setLoading(false)
            return
        }
        loadLive()
    }, [id, loadLive])

    const handleForward = async () => {
        if (!request) return
        if (!isLiveApiEnabled()) {
            const updated = forwardTcRequestToSuperAdmin(id, prmRemarks)
            if (updated) setRequest(updated)
            return
        }
        setBusy(true)
        const res = await forwardTcRequest(request.requestId || id, prmRemarks)
        setBusy(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not forward TC request.')
            return
        }
        toast.success('TC request forwarded on the server.')
        setRequest(res.data)
    }

    const handleReject = async () => {
        if (!request) return
        if (!isLiveApiEnabled()) {
            const updated = rejectTcRequest(id, prmRemarks, 'prm')
            if (updated) setRequest(updated)
            return
        }
        setBusy(true)
        const res = await rejectTcRequestAtPrm(request.requestId || id, prmRemarks)
        setBusy(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not reject TC request.')
            return
        }
        toast.success('TC request rejected at PRM review.')
        setRequest(res.data)
    }

    if (loading) {
        return (
            <section className='space-y-6'>
                <button type='button' onClick={() => navigate('/front-office/tc-request')} className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2'>
                    <ArrowLeft size={18} /> Back to list
                </button>
                <FeedbackState kind='loading' title='Loading TC request' description={`Fetching ${id}…`} />
            </section>
        )
    }

    return (
        <section className='space-y-6'>
            <button type='button' onClick={() => navigate('/front-office/tc-request')} className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer'>
                <ArrowLeft size={18} />
                Back to list
            </button>

            {!request ? (
                <div className='bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]'>{error || 'TC request not found.'}</div>
            ) : (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <div className='flex flex-wrap items-center gap-3'>
                            <h1 className='text-2xl font-semibold text-black'>{request.requestId}</h1>
                            <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${tcStatusBadgeClass(request)}`}>
                                {displayTcStatus(request)}
                            </span>
                        </div>
                        <p className='text-sm text-[#667085] mt-2'>
                            {request.studentName} · {request.classSection} · Requested by {request.requestedBy}
                        </p>
                    </div>

                    <Section title='Client TC workflow'>
                        <ol className='grid gap-2 text-sm text-slate-700'>
                            {CLIENT_TC_WORKFLOW_STEPS.map((step, index) => {
                                const active = isTcWorkflowStepCurrent(step.key, request)
                                return (
                                    <li key={step.key} className={`flex gap-2 rounded-lg px-2 py-1 ${active ? 'bg-indigo-50 font-semibold text-indigo-900' : ''}`}>
                                        <span className='font-semibold text-slate-500'>{index + 1}.</span>
                                        <span>{step.label}{active ? ' · current' : ''}</span>
                                    </li>
                                )
                            })}
                        </ol>
                        {live && !['Approved', 'Rejected'].includes(request.status) && resolveTcWorkflowStage(request) !== 'prm' && resolveTcWorkflowStage(request) !== 'md' ? (
                            <button
                                type='button'
                                disabled={busy}
                                onClick={async () => {
                                    setBusy(true)
                                    const res = await advanceTcRequest(request.requestId || id, prmRemarks || 'Stage advanced')
                                    setBusy(false)
                                    if (!res.success) {
                                        toast.error(typeof res.error === 'string' ? res.error : 'Could not advance TC stage.')
                                        return
                                    }
                                    setRequest(res.data)
                                    toast.success(`Advanced to ${res.data.workflowStage || 'next stage'}.`)
                                }}
                                className='mt-3 min-h-10 rounded-md border border-[#515DEF] px-4 text-sm font-semibold text-[#515DEF] disabled:opacity-50'
                            >
                                Advance academic stage
                            </button>
                        ) : null}
                    </Section>

                    <Section title='TC Request Information'>
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                            <Field label='Student Name' value={request.studentName} />
                            <Field label='Admission Number' value={request.admissionNumber} />
                            <Field label='Class / Section' value={request.classSection} />
                            <Field label='Requested On' value={request.requestedOn} />
                            <Field label='Last Date of Attendance' value={request.lastDateOfAttendance} />
                            <Field label='Transfer To' value={request.transferTo} />
                            <div className='lg:col-span-3'><Field label='Reason' value={request.reason} /></div>
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
                                            <tr key={noc.departmentKey || noc.department} className='hover:bg-slate-50/70 transition-colors'>
                                                <td className='py-3 px-4 font-bold text-slate-900'>{noc.department}</td>
                                                <td className='py-3 px-4 font-medium text-slate-700'>{noc.manager}</td>
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
                                                <td className='py-3 px-4 text-slate-600 max-w-xs'>{noc.remarks}</td>
                                                <td className='py-3 px-4 font-mono text-slate-500'>{noc.date}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Section>
                    ) : null}

                    {resolveTcWorkflowStage(request) === 'prm' && !['Approved', 'Rejected'].includes(request.status) ? (
                        <Section title='PRM Action'>
                            <div className='space-y-4'>
                                <div className='flex flex-col gap-y-2'>
                                    <label htmlFor='prm-remarks' className='text-base font-medium text-[#808080]'>PRM Remarks</label>
                                    <textarea
                                        id='prm-remarks'
                                        rows={3}
                                        value={prmRemarks}
                                        onChange={(e) => setPrmRemarks(e.target.value)}
                                        placeholder='Verification notes before forwarding to Class Teacher'
                                        className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                                    />
                                </div>
                                <div className='flex sm:justify-end justify-center gap-x-4'>
                                    <button type='button' disabled={busy} onClick={handleReject} className='bg-white text-[#FF0000] text-sm px-8 py-2 rounded-md border border-[#FF0000] hover:bg-[#FF0000] hover:text-white transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-60'>
                                        Reject
                                    </button>
                                    <button type='button' disabled={busy} onClick={handleForward} className='bg-[#515DEF] text-white text-sm px-8 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-60'>
                                        Forward to Class Teacher
                                    </button>
                                </div>
                            </div>
                        </Section>
                    ) : null}

                    {resolveTcWorkflowStage(request) !== 'prm' && request.prmRemarks ? (
                        <Section title='PRM Remarks'>
                            <Field label='Remarks' value={request.prmRemarks} />
                            {request.forwardedOn ? <Field label='Forwarded On' value={request.forwardedOn} /> : null}
                        </Section>
                    ) : null}
                </>
            )}
        </section>
    )
}

export default ViewTcRequest
