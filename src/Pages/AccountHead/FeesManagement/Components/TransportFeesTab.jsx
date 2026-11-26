import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useFinance } from '../../financeDomain/FinanceContext'
import {
    assignTransportFeeApi,
    collectTransportFeeApi,
    listTransportFeesApi,
    upsertTransportFeeApi,
} from '../../../../services/api/transportFeeApiService.js'
import { listTransportRoutes } from '../../../../services/api/transportApiService.js'

const inputClass = 'border border-[#D9D9D9] rounded-md px-2 py-2 text-sm w-full'
const BILLING = ['Yearly', 'Half Yearly', 'Quarterly', 'Monthly']
const emptyState = { fees: [], assignments: [] }

const TransportFeesTab = () => {
    const { students = [], rehydrateFromApi } = useFinance()
    const [state, setState] = useState(emptyState)
    const [routes, setRoutes] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const refresh = useCallback(async () => {
        setLoading(true)
        setError('')
        const [feesRes, routesRes] = await Promise.all([listTransportFeesApi(), listTransportRoutes()])
        if (!feesRes.success) {
            setError(feesRes.error || 'Could not load transport fees from the server.')
            setState(emptyState)
            setLoading(false)
            return feesRes
        }
        setState({
            fees: feesRes.data.fees || [],
            assignments: feesRes.data.assignments || [],
        })
        setRoutes(routesRes.success && Array.isArray(routesRes.data) ? routesRes.data : [])
        setLoading(false)
        return feesRes
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    const createFee = async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        const routeId = String(data.get('routeId') || '')
        const route = routes.find((row) => String(row.id) === routeId)
        setSaving(true)
        const res = await upsertTransportFeeApi({
            routeId,
            routeName: route?.routeName || data.get('routeName') || routeId,
            billingCycle: data.get('billingCycle'),
            amount: data.get('amount'),
            academicYear: data.get('academicYear'),
            remarks: data.get('remarks'),
        })
        setSaving(false)
        if (!res.success) {
            toast.error(res.error || 'Could not create transport fee.')
            return
        }
        form.reset()
        toast.success('Transport fee saved to campus ledger.')
        await refresh()
    }

    const assign = async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        const student = students.find((item) => item.id === data.get('studentId'))
        const fee = state.fees.find((item) => item.id === data.get('feeId'))
        setSaving(true)
        const res = await assignTransportFeeApi({
            feeId: data.get('feeId'),
            studentId: data.get('studentId'),
            studentName: student?.name,
            routeId: fee?.routeId,
            routeName: fee?.routeName,
            stopName: data.get('stopName'),
            className: student?.className || 'Transport',
        })
        setSaving(false)
        if (!res.success) {
            toast.error(res.error || 'Could not assign transport fee.')
            return
        }
        const body = res.data && typeof res.data === 'object' ? res.data : res
        if (body?.skipped) {
            toast.info('Assignment already exists — no duplicate installment created.')
        } else {
            toast.success('Student assigned and transport installment posted.')
        }
        form.reset()
        await refresh()
        if (typeof rehydrateFromApi === 'function') await rehydrateFromApi()
    }

    const collect = async (assignment) => {
        if (String(assignment.paymentStatus || '').toLowerCase() === 'paid') {
            toast.info('Already paid.')
            return
        }
        setSaving(true)
        const res = await collectTransportFeeApi({
            assignmentId: assignment.id,
            paymentMode: 'CASH',
        })
        setSaving(false)
        if (!res.success) {
            toast.error(res.error || 'Collection failed.')
            return
        }
        const body = res.data && typeof res.data === 'object' ? res.data : res
        const receiptNo = body?.receipt?.receiptNo || body?.assignment?.receiptNo
        if (body?.skipped) toast.info('Payment already recorded.')
        else toast.success(receiptNo ? `Receipt ${receiptNo} issued.` : 'Transport fee collected.')
        await refresh()
        if (typeof rehydrateFromApi === 'function') await rehydrateFromApi()
    }

    return (
        <div className='space-y-6'>
            {error ? (
                <div className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3'>
                    <span>{error}</span>
                    <button type='button' onClick={refresh} className='underline cursor-pointer'>Retry</button>
                </div>
            ) : null}
            {loading ? <p className='text-sm text-[#667085]'>Loading transport fees from campus finance…</p> : null}

            <form onSubmit={createFee} className='bg-white rounded-2xl shadow-md p-4 grid md:grid-cols-3 gap-3'>
                <h2 className='md:col-span-3 text-lg font-medium'>Transport route fee</h2>
                <select name='routeId' required className={inputClass} disabled={saving}>
                    <option value=''>Select route</option>
                    {routes.map((route) => (
                        <option key={route.id} value={route.id}>{route.routeName || route.id}</option>
                    ))}
                </select>
                <select name='billingCycle' className={inputClass} disabled={saving} defaultValue='Yearly'>
                    {BILLING.map((item) => <option key={item}>{item}</option>)}
                </select>
                <input name='academicYear' required defaultValue='2026-27' placeholder='Academic year' className={inputClass} disabled={saving} />
                <input name='amount' type='number' min='1' required placeholder='Fee amount' className={inputClass} disabled={saving} />
                <input name='remarks' placeholder='Remarks' className={inputClass} disabled={saving} />
                <button type='submit' disabled={saving} className='bg-[#515DEF] text-white rounded-md text-sm cursor-pointer disabled:opacity-60'>
                    {saving ? 'Saving…' : 'Create transport fee'}
                </button>
            </form>

            <form onSubmit={assign} className='bg-white rounded-2xl shadow-md p-4 grid md:grid-cols-3 gap-3'>
                <h2 className='md:col-span-3 text-lg font-medium'>Assign student to route fee</h2>
                <select name='feeId' required className={inputClass} disabled={saving || state.fees.length === 0}>
                    <option value=''>Select fee</option>
                    {state.fees.map((fee) => (
                        <option key={fee.id} value={fee.id}>
                            {fee.routeName || fee.routeId} · {fee.billingCycle} ₹{fee.amount}
                        </option>
                    ))}
                </select>
                <select name='studentId' required className={inputClass} disabled={saving}>
                    <option value=''>Select student</option>
                    {students.map((student) => (
                        <option key={student.id} value={student.id}>{student.name}</option>
                    ))}
                </select>
                <input name='stopName' placeholder='Stop name' className={inputClass} disabled={saving} />
                <button type='submit' disabled={saving || state.fees.length === 0} className='bg-[#515DEF] text-white rounded-md text-sm cursor-pointer disabled:opacity-60'>
                    {saving ? 'Saving…' : 'Assign'}
                </button>
            </form>

            <div className='bg-white rounded-2xl shadow-md p-4 overflow-x-auto'>
                <div className='flex items-center justify-between gap-3 mb-3'>
                    <h2 className='text-lg font-medium'>Transport assignments</h2>
                    <button type='button' onClick={refresh} className='text-sm text-[#515DEF] cursor-pointer' disabled={loading || saving}>Refresh</button>
                </div>
                <table className='w-full text-sm text-left'>
                    <thead className='bg-[#EDEEF5]'>
                        <tr>
                            {['Route', 'Student', 'Billing', 'Amount', 'Payment', 'Receipt'].map((label) => (
                                <th key={label} className='px-2 py-2'>{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {!loading && state.assignments.length === 0 && (
                            <tr><td className='px-2 py-4 text-[#667085]' colSpan={6}>No transport-fee assignments yet.</td></tr>
                        )}
                        {state.assignments.map((item) => (
                            <tr key={item.id} className='border-b border-[#f2f4f7]'>
                                <td className='px-2 py-2'>{item.routeName || item.routeId}</td>
                                <td className='px-2 py-2'>{item.studentName || item.studentId}</td>
                                <td className='px-2 py-2'>{item.billingCycle}</td>
                                <td className='px-2 py-2'>{item.payable ?? item.amount}</td>
                                <td className='px-2 py-2'>{item.paymentStatus || 'Unpaid'}</td>
                                <td className='px-2 py-2'>
                                    {item.receiptNo || String(item.paymentStatus || '').toLowerCase() === 'paid' ? (
                                        item.receiptNo || 'Paid'
                                    ) : (
                                        <button type='button' onClick={() => collect(item)} disabled={saving} className='text-[#515DEF] cursor-pointer disabled:opacity-60'>
                                            Collect
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className='text-xs text-[#667085] mt-3'>
                    Live campus finance snapshot. Assign posts one installment per student/route fee; Collect issues a Finance receipt. Duplicates are idempotent.
                </p>
            </div>
        </div>
    )
}

export default TransportFeesTab
