import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useFinance } from '../../financeDomain/FinanceContext'
import { ACTIVITY_TYPES } from '../activityFeeConstants'
import {
    assignActivityFeeApi,
    collectActivityFeeApi,
    listActivityFeesApi,
    updateActivityAttendanceApi,
    upsertActivityFeeApi,
} from '../../../../services/api/activityFeeApiService.js'

const inputClass = 'border border-[#D9D9D9] rounded-md px-2 py-2 text-sm w-full'

const emptyState = { fees: [], assignments: [] }

const ActivityFeesTab = () => {
    const { students = [], rehydrateFromApi } = useFinance()
    const [state, setState] = useState(emptyState)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [activityType, setActivityType] = useState('Rifle')
    const [participantType, setParticipantType] = useState('Insider')

    const refresh = useCallback(async () => {
        setLoading(true)
        setError('')
        const res = await listActivityFeesApi()
        if (!res.success) {
            setError(res.error || 'Could not load activity fees from the server.')
            setState(emptyState)
            setLoading(false)
            return res
        }
        setState({
            fees: res.data.fees || [],
            assignments: res.data.assignments || [],
        })
        setLoading(false)
        return res
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    const createFee = async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        setSaving(true)
        const res = await upsertActivityFeeApi({
            activityType: data.get('activityType'),
            customName: data.get('customName'),
            insiderAmount: data.get('insiderAmount'),
            outsiderAmount: data.get('outsiderAmount'),
            academicYear: data.get('academicYear'),
            attendanceRequired: data.get('attendanceRequired'),
            concessionApplicable: data.get('concessionApplicable'),
            remarks: data.get('remarks'),
        })
        setSaving(false)
        if (!res.success) {
            toast.error(res.error || 'Could not create activity fee.')
            return
        }
        form.reset()
        setActivityType('Rifle')
        toast.success('Activity fee saved to campus ledger.')
        await refresh()
    }

    const assign = async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        const type = data.get('participantType')
        const student = students.find((item) => item.id === data.get('studentId'))
        setSaving(true)
        const res = await assignActivityFeeApi({
            feeId: data.get('feeId'),
            participantType: type,
            studentId: data.get('studentId'),
            outsiderName: type === 'Outsider' ? data.get('outsiderName') : undefined,
            participantName: type === 'Outsider' ? data.get('outsiderName') : student?.name,
            concessionMode: data.get('concessionMode'),
            concessionValue: data.get('concessionValue'),
        })
        setSaving(false)
        if (!res.success) {
            toast.error(res.error || 'Could not assign participant.')
            return
        }
        const assignBody = res.data && typeof res.data === 'object' ? res.data : res
        if (assignBody?.skipped) {
            toast.info('Assignment already exists — no duplicate installment created.')
        } else {
            toast.success('Participant assigned and installment posted.')
        }
        form.reset()
        setParticipantType('Insider')
        await refresh()
        if (typeof rehydrateFromApi === 'function') {
            await rehydrateFromApi()
        }
    }

    const collect = async (assignment) => {
        if (String(assignment.paymentStatus || '').toLowerCase() === 'paid') {
            toast.info('Already paid.')
            return
        }
        setSaving(true)
        const res = await collectActivityFeeApi({
            assignmentId: assignment.id,
            paymentMode: 'CASH',
        })
        setSaving(false)
        if (!res.success) {
            toast.error(res.error || 'Collection failed.')
            return
        }
        const collectBody = res.data && typeof res.data === 'object' ? res.data : res
        const receiptNo = collectBody?.receipt?.receiptNo || collectBody?.assignment?.receiptNo
        if (collectBody?.skipped) {
            toast.info('Payment already recorded.')
        } else {
            toast.success(receiptNo ? `Receipt ${receiptNo} issued.` : 'Activity fee collected.')
        }
        await refresh()
        if (typeof rehydrateFromApi === 'function') {
            await rehydrateFromApi()
        }
    }

    const onAttendanceBlur = async (assignment, value) => {
        const next = String(value || '').trim()
        if (next === String(assignment.attendance || '').trim()) return
        const res = await updateActivityAttendanceApi({
            assignmentId: assignment.id,
            attendance: next,
        })
        if (!res.success) {
            toast.error(res.error || 'Attendance could not be saved.')
            await refresh()
            return
        }
        await refresh()
    }

    return (
        <div className='space-y-6'>
            {error ? (
                <div className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3'>
                    <span>{error}</span>
                    <button type='button' onClick={refresh} className='underline cursor-pointer'>
                        Retry
                    </button>
                </div>
            ) : null}
            {loading ? (
                <p className='text-sm text-[#667085]'>Loading activity fees from campus finance…</p>
            ) : null}

            <form onSubmit={createFee} className='bg-white rounded-2xl shadow-md p-4 grid md:grid-cols-3 gap-3'>
                <h2 className='md:col-span-3 text-lg font-medium'>Manual activity fee</h2>
                <select
                    name='activityType'
                    value={activityType}
                    onChange={(event) => setActivityType(event.target.value)}
                    className={inputClass}
                    disabled={saving}
                >
                    {ACTIVITY_TYPES.map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </select>
                {activityType === 'Other' && (
                    <input name='customName' required placeholder='Activity name' className={inputClass} disabled={saving} />
                )}
                <input name='academicYear' required placeholder='Academic year' defaultValue='2026-27' className={inputClass} disabled={saving} />
                <input name='insiderAmount' type='number' min='0' required placeholder='Insider amount' className={inputClass} disabled={saving} />
                <input name='outsiderAmount' type='number' min='0' required placeholder='Outsider amount' className={inputClass} disabled={saving} />
                <select name='attendanceRequired' className={inputClass} disabled={saving}>
                    <option value='yes'>Attendance required</option>
                    <option value='no'>Attendance not required</option>
                </select>
                <select name='concessionApplicable' className={inputClass} disabled={saving}>
                    <option value='yes'>Concession applicable</option>
                    <option value='no'>Concession not applicable</option>
                </select>
                <input name='remarks' placeholder='Remarks' className={inputClass} disabled={saving} />
                <button type='submit' disabled={saving} className='bg-[#515DEF] text-white rounded-md text-sm cursor-pointer disabled:opacity-60'>
                    {saving ? 'Saving…' : 'Create activity fee'}
                </button>
            </form>

            <form onSubmit={assign} className='bg-white rounded-2xl shadow-md p-4 grid md:grid-cols-3 gap-3'>
                <h2 className='md:col-span-3 text-lg font-medium'>Assign participant</h2>
                <select name='feeId' required className={inputClass} disabled={saving || state.fees.length === 0}>
                    <option value=''>Select fee</option>
                    {state.fees.map((fee) => (
                        <option key={fee.id} value={fee.id}>
                            {fee.activityName} · Insider ₹{fee.insiderAmount} · Outsider ₹{fee.outsiderAmount}
                        </option>
                    ))}
                </select>
                <select
                    name='participantType'
                    value={participantType}
                    onChange={(event) => setParticipantType(event.target.value)}
                    className={inputClass}
                    disabled={saving}
                >
                    <option>Insider</option>
                    <option>Outsider</option>
                </select>
                {participantType === 'Insider' ? (
                    <select name='studentId' required className={inputClass} disabled={saving}>
                        <option value=''>Select student</option>
                        {students.map((student) => (
                            <option key={student.id} value={student.id}>
                                {student.name}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input name='outsiderName' required placeholder='Outsider name' className={inputClass} disabled={saving} />
                )}
                <select name='concessionMode' className={inputClass} disabled={saving}>
                    <option>No Concession</option>
                    <option>Percentage</option>
                    <option>Fixed Amount</option>
                </select>
                <input name='concessionValue' type='number' min='0' placeholder='Concession value' className={inputClass} disabled={saving} />
                <button type='submit' disabled={saving || state.fees.length === 0} className='bg-[#515DEF] text-white rounded-md text-sm cursor-pointer disabled:opacity-60'>
                    {saving ? 'Saving…' : 'Assign'}
                </button>
            </form>

            <div className='bg-white rounded-2xl shadow-md p-4 overflow-x-auto'>
                <div className='flex items-center justify-between gap-3 mb-3'>
                    <h2 className='text-lg font-medium'>Assignments</h2>
                    <button type='button' onClick={refresh} className='text-sm text-[#515DEF] cursor-pointer' disabled={loading || saving}>
                        Refresh
                    </button>
                </div>
                <table className='w-full text-sm text-left'>
                    <thead className='bg-[#EDEEF5]'>
                        <tr>
                            {['Activity', 'Participant', 'Type', 'Gross', 'Payable', 'Attendance', 'Payment', 'Receipt'].map((label) => (
                                <th key={label} className='px-2 py-2'>
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && state.assignments.length === 0 && (
                            <tr>
                                <td className='px-2 py-4 text-[#667085]' colSpan={8}>
                                    No activity-fee assignments yet.
                                </td>
                            </tr>
                        )}
                        {state.assignments.map((item) => (
                            <tr key={item.id} className='border-b border-[#f2f4f7]'>
                                <td className='px-2 py-2'>{item.activityName}</td>
                                <td className='px-2 py-2'>{item.participantName}</td>
                                <td className='px-2 py-2'>{item.participantType}</td>
                                <td className='px-2 py-2'>{item.gross}</td>
                                <td className='px-2 py-2'>{item.payable}</td>
                                <td className='px-2 py-2'>
                                    <input
                                        defaultValue={item.attendance || ''}
                                        key={`${item.id}-${item.attendance || ''}`}
                                        placeholder='Present / Absent'
                                        className='border rounded px-2 py-1'
                                        disabled={saving}
                                        onBlur={(event) => onAttendanceBlur(item, event.target.value)}
                                    />
                                </td>
                                <td className='px-2 py-2'>{item.paymentStatus || 'Unpaid'}</td>
                                <td className='px-2 py-2'>
                                    {item.receiptNo || String(item.paymentStatus || '').toLowerCase() === 'paid' ? (
                                        item.receiptNo || 'Paid'
                                    ) : (
                                        <button
                                            type='button'
                                            onClick={() => collect(item)}
                                            disabled={saving}
                                            className='text-[#515DEF] cursor-pointer disabled:opacity-60'
                                        >
                                            Collect
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className='text-xs text-[#667085] mt-3'>
                    Data is loaded from the live campus finance snapshot. Assign posts an installment; Collect posts a receipt through Finance. Duplicate assign/collect calls are idempotent.
                </p>
            </div>
        </div>
    )
}

export default ActivityFeesTab
