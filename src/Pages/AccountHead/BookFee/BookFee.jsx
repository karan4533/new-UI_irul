import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ConfirmAction, IntegrationNotice, PageHeader } from '../../../Common/ui'
import { BookFeePage } from '../../../Common/demoDomain/DemoScreens'
import { useFinance } from '../financeDomain/FinanceContext'
import LiveStatusBanner from '../financeDomain/LiveStatusBanner'
import { deleteBookFeeApi, listBookFeesApi, upsertBookFeeApi } from '../../../services/api/financeExtrasApiService.js'
import { isLiveApiEnabled } from '../../../services/api/tokenStore.js'

const inputClass = 'text-sm border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
const th = 'px-2 py-3 text-left'
const td = 'px-2 py-3'
const inr = (value) => (value === null || value === undefined ? '—' : `₹${Number(value).toLocaleString('en-IN')}`)
const EMPTY_FORM = { id: '', studentId: '', academicYear: '2026-27', vendor: '', book: '', quantity: 1, unitCost: '', assignedFee: '' }
const STATUS_TONE = { Matched: 'text-[#176B3A]', 'Under-allocated': 'text-[#B54708]', 'Over-allocated': 'text-[#A51D35]' }

function LiveBookFee() {
    const { rehydrateFromApi } = useFinance()
    const [data, setData] = useState({ lines: [], summaries: [], students: [], totals: null })
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [form, setForm] = useState(EMPTY_FORM)
    const [pendingDelete, setPendingDelete] = useState(null)

    const refresh = useCallback(async () => {
        setLoading(true)
        const res = await listBookFeesApi()
        setLoading(false)
        if (!res.success) {
            setError(res.error)
            return
        }
        setError('')
        setData({
            lines: res.data.lines || [],
            summaries: res.data.summaries || [],
            students: res.data.students || [],
            totals: res.data.totals || null,
        })
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    const afterAction = async (message) => {
        setNotice(message)
        await refresh()
        await rehydrateFromApi?.()
    }

    const submit = async (event) => {
        event.preventDefault()
        setBusy(true)
        setNotice('')
        const payload = {
            ...(form.id ? { id: form.id } : {}),
            studentId: form.studentId,
            academicYear: form.academicYear,
            vendor: form.vendor,
            book: form.book,
            quantity: Number(form.quantity),
            unitCost: form.unitCost === '' ? null : Number(form.unitCost),
            assignedFee: form.assignedFee === '' ? null : Number(form.assignedFee),
        }
        const res = await upsertBookFeeApi(payload)
        setBusy(false)
        if (!res.success) {
            setError(res.error)
            return
        }
        setError('')
        setForm({ ...EMPTY_FORM, studentId: form.studentId, academicYear: form.academicYear })
        await afterAction(res.data?.skipped ? 'This book line already exists for the student — nothing changed.' : `Book line ${res.data?.line?.id} saved.`)
    }

    const confirmDelete = async () => {
        const line = pendingDelete
        setPendingDelete(null)
        if (!line) return
        setBusy(true)
        const res = await deleteBookFeeApi(line.id)
        setBusy(false)
        if (!res.success) {
            setError(res.error)
            return
        }
        await afterAction(`Book line ${line.id} removed.`)
    }

    const edit = (line) => setForm({
        id: line.id,
        studentId: line.studentId,
        academicYear: line.academicYear,
        vendor: line.vendor,
        book: line.book,
        quantity: line.quantity,
        unitCost: line.unitCost,
        assignedFee: line.assignedFee ?? '',
    })

    return (
        <section className='space-y-4'>
            <PageHeader
                title='Book fee breakup'
                description='Vendor book lines that make up each student’s assigned book fee. Collection still happens through the student fee ledger.'
                actions={<button type='button' onClick={refresh} disabled={loading} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-4 text-sm font-semibold cursor-pointer disabled:opacity-60'><RefreshCw aria-hidden='true' size={16} /> Refresh</button>}
            />
            <IntegrationNotice state='connected' title='Live book fee register (PostgreSQL)' description='Lines are saved on the campus finance record with audit events. A student’s assigned book fee is compared with the sum of vendor lines; mismatches are flagged.' />
            <LiveStatusBanner loading={loading} error={error} notice={notice} onRetry={refresh} />

            {data.totals ? (
                <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                    {[
                        ['Book lines', data.totals.lineCount],
                        ['Students', data.totals.studentCount],
                        ['Line total', data.totals.lineTotalLabel],
                        ['Mismatched students', data.totals.mismatchCount],
                    ].map(([label, value]) => (
                        <div key={label} className='bg-white rounded-2xl shadow-md p-4'>
                            <p className='text-xs text-[#808080]'>{label}</p>
                            <p className='text-xl font-semibold'>{value}</p>
                        </div>
                    ))}
                </div>
            ) : null}

            <form onSubmit={submit} className='bg-white rounded-2xl shadow-md p-4 grid grid-cols-1 md:grid-cols-4 gap-3'>
                <h2 className='md:col-span-4 text-lg font-semibold'>{form.id ? `Edit ${form.id}` : 'Add book line'}</h2>
                <label className='grid gap-1 text-sm font-medium'>Student
                    <select required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className={inputClass} disabled={Boolean(form.id)}>
                        <option value=''>Select student</option>
                        {data.students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.className ? ` · ${s.className}` : ''}</option>)}
                    </select>
                </label>
                <label className='grid gap-1 text-sm font-medium'>Academic year
                    <input required value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} placeholder='2026-27' className={inputClass} />
                </label>
                <label className='grid gap-1 text-sm font-medium'>Vendor
                    <input required value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className={inputClass} />
                </label>
                <label className='grid gap-1 text-sm font-medium'>Book / package
                    <input required value={form.book} onChange={(e) => setForm({ ...form, book: e.target.value })} className={inputClass} />
                </label>
                <label className='grid gap-1 text-sm font-medium'>Quantity
                    <input required type='number' min='1' step='1' value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputClass} />
                </label>
                <label className='grid gap-1 text-sm font-medium'>Unit cost (₹)
                    <input required type='number' min='0' step='0.01' value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} className={inputClass} />
                </label>
                <label className='grid gap-1 text-sm font-medium'>Assigned book fee (₹, optional)
                    <input type='number' min='0' step='0.01' value={form.assignedFee} onChange={(e) => setForm({ ...form, assignedFee: e.target.value })} className={inputClass} />
                </label>
                <div className='flex items-end gap-2'>
                    <button disabled={busy} className='min-h-10 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white cursor-pointer disabled:opacity-60'>{busy ? 'Saving…' : 'Save line'}</button>
                    {form.id ? <button type='button' onClick={() => setForm(EMPTY_FORM)} className='min-h-10 rounded-lg border px-4 text-sm cursor-pointer'>Cancel</button> : null}
                </div>
            </form>

            <div className='bg-white rounded-2xl shadow-md p-4 overflow-x-auto'>
                <h2 className='text-lg font-semibold mb-3'>Per-student check</h2>
                <table className='w-full text-sm'>
                    <thead className='text-xs bg-[#EDEEF5]'><tr>{['Student', 'Year', 'Vendors', 'Assigned fee', 'Line total', 'Difference', 'Status'].map((l) => <th key={l} className={th}>{l}</th>)}</tr></thead>
                    <tbody>
                        {data.summaries.length === 0 && !loading ? <tr><td colSpan={7} className='px-2 py-6 text-[#667085]'>No book fee lines recorded yet.</td></tr> : null}
                        {data.summaries.map((row) => (
                            <tr key={`${row.studentId}-${row.academicYear}`} className='border-b border-[#f2f4f7]'>
                                <td className={td}>{row.student}</td>
                                <td className={td}>{row.academicYear}</td>
                                <td className={td}>{row.vendors.join(', ')}</td>
                                <td className={td}>{inr(row.assignedFee)}</td>
                                <td className={td}>{inr(row.lineTotal)}</td>
                                <td className={td}>{inr(row.difference)}</td>
                                <td className={`${td} font-medium ${STATUS_TONE[row.status] || ''}`}>{row.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 overflow-x-auto'>
                <h2 className='text-lg font-semibold mb-3'>Book lines</h2>
                <table className='w-full text-sm'>
                    <thead className='text-xs bg-[#EDEEF5]'><tr>{['Line', 'Student', 'Year', 'Vendor', 'Book', 'Qty', 'Unit', 'Line total', 'Actions'].map((l) => <th key={l} className={th}>{l}</th>)}</tr></thead>
                    <tbody>
                        {data.lines.map((row) => (
                            <tr key={row.id} className='border-b border-[#f2f4f7]'>
                                <td className={td}>{row.id}</td>
                                <td className={td}>{row.student}</td>
                                <td className={td}>{row.academicYear}</td>
                                <td className={td}>{row.vendor}</td>
                                <td className={td}>{row.book}</td>
                                <td className={td}>{row.quantity}</td>
                                <td className={td}>{inr(row.unitCost)}</td>
                                <td className={td}>{inr(row.total)}</td>
                                <td className={td}>
                                    <div className='flex gap-2'>
                                        <button type='button' disabled={busy} onClick={() => edit(row)} className='text-xs font-semibold text-[#515DEF] cursor-pointer'>Edit</button>
                                        <button type='button' disabled={busy} onClick={() => setPendingDelete(row)} className='text-xs font-semibold text-[#A51D35] cursor-pointer'>Delete</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ConfirmAction
                open={Boolean(pendingDelete)}
                onClose={() => setPendingDelete(null)}
                onConfirm={confirmDelete}
                title='Remove book line?'
                description={pendingDelete ? `${pendingDelete.book} (${pendingDelete.vendor}) for ${pendingDelete.student} will be removed. This is recorded in the audit log.` : ''}
                confirmLabel='Remove line'
                tone='danger'
            />
        </section>
    )
}

export default function BookFee() {
    return isLiveApiEnabled() ? <LiveBookFee /> : <BookFeePage />
}
