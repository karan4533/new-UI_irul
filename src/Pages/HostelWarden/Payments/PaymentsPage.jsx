import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listHostelAssignments, listHostelPayments, upsertHostelPayment } from '../../../services/api/hostelApiService'

const emptyForm = {
    studentId: '',
    studentName: '',
    admissionNumber: '',
    amount: '',
    status: 'Pending',
    dueDate: new Date().toISOString().slice(0, 10),
    remarks: '',
}

const PaymentsPage = () => {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [residents, setResidents] = useState([])
    const [form, setForm] = useState(emptyForm)
    const [loading, setLoading] = useState(Boolean(live))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const [p, a] = await Promise.all([listHostelPayments(), listHostelAssignments()])
        setLoading(false)
        if (!p.success) {
            setError(typeof p.error === 'string' ? p.error : 'Failed to load payments.')
            setRows([])
            return
        }
        setRows(Array.isArray(p.data) ? p.data : [])
        setResidents(
            (a.success && Array.isArray(a.data) ? a.data : []).filter(
                (row) => String(row.status || '').toLowerCase() !== 'vacated',
            ),
        )
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => rows, [rows])

    const onSelectResident = (studentId) => {
        const resident = residents.find((row) => String(row.studentId) === String(studentId))
        setForm((prev) => ({
            ...prev,
            studentId,
            studentName: resident?.studentName || '',
            admissionNumber: resident?.admissionNumber || '',
        }))
    }

    const handleSave = async () => {
        if (!form.studentId || !form.amount) {
            toast.error('Student and amount are required.')
            return
        }
        setSaving(true)
        const res = await upsertHostelPayment({
            ...form,
            amount: Number(form.amount) || 0,
        })
        setSaving(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not save payment.')
            return
        }
        toast.success('Hostel payment saved on the server.')
        setForm(emptyForm)
        setRows(res.rows || [])
    }

    return (
        <section className='space-y-6'>
            <div>
                <h1 className='text-2xl font-semibold text-black'>Hostel Payments</h1>
                <p className='text-sm text-[#667085] mt-1'>
                    Payment dues recorded on /api/v1/ops/hostel-payments (not a live payment gateway).
                </p>
            </div>

            {live ? (
                <p className='text-xs font-medium text-[#027A48]'>Live · GET/PUT /api/v1/ops/hostel-payments</p>
            ) : null}
            {error ? <FeedbackState kind='error' title='Payments API unavailable' description={error} /> : null}
            {loading ? <FeedbackState kind='loading' title='Loading payments' description='Fetching hostel payments…' /> : null}

            {!loading && !error ? (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
                        <h2 className='text-lg font-semibold text-black'>Add payment row</h2>
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Resident</label>
                                <select
                                    value={form.studentId}
                                    onChange={(e) => onSelectResident(e.target.value)}
                                    className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2'
                                >
                                    <option value=''>Select resident</option>
                                    {residents.map((row) => (
                                        <option key={row.id} value={row.studentId}>
                                            {row.studentName} ({row.roomNumber}/{row.bedNumber})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Amount</label>
                                <input type='number' value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Status</label>
                                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2'>
                                    <option value='Pending'>Pending</option>
                                    <option value='Paid'>Paid</option>
                                    <option value='Partial'>Partial</option>
                                </select>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Due date</label>
                                <input type='date' value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                            </div>
                            <div className='flex flex-col gap-y-2 md:col-span-2'>
                                <label className='text-sm text-[#808080]'>Remarks</label>
                                <input value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                            </div>
                        </div>
                        <button type='button' disabled={saving} onClick={handleSave} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md disabled:opacity-60'>
                            {saving ? 'Saving…' : 'Save payment'}
                        </button>
                    </div>

                    <div className='bg-white rounded-2xl shadow-md p-4 overflow-x-auto'>
                        <table className='w-full text-sm text-left'>
                            <thead className='text-xs bg-[#EDEEF5]'>
                                <tr>
                                    <th className='px-2 py-3'>ID</th>
                                    <th className='px-2 py-3'>Student</th>
                                    <th className='px-2 py-3'>Amount</th>
                                    <th className='px-2 py-3'>Status</th>
                                    <th className='px-2 py-3'>Due</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={5} className='px-2 py-8 text-center text-[#667085]'>No payment records.</td></tr>
                                ) : filtered.map((row) => (
                                    <tr key={row.id} className='border-b border-[#f2f4f7]'>
                                        <td className='px-2 py-3'>{row.id}</td>
                                        <td className='px-2 py-3'>{row.studentName || row.studentId}</td>
                                        <td className='px-2 py-3'>{row.amount}</td>
                                        <td className='px-2 py-3'>{row.status}</td>
                                        <td className='px-2 py-3'>{row.dueDate || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : null}
        </section>
    )
}

export default PaymentsPage
