import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, X, CheckCircle2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listGateTeamAttendance, upsertGateTeamAttendance } from '../../../services/api/gateApiService'

const STATUS_OPTIONS = ['Present', 'Absent', 'Late', 'On Leave']

const emptyForm = {
    employeeId: '',
    name: '',
    gate: '',
    date: new Date().toISOString().slice(0, 10),
    inTime: '',
    outTime: '',
    attendanceStatus: 'Present',
}

const GatekeepersAttendance = () => {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(emptyForm)

    const load = useCallback(async () => {
        if (!live) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const res = await listGateTeamAttendance()
        if (!res.success) {
            setRows([])
            setError(res.error || 'Failed to load /api/v1/ops/gate-team-attendance.')
            setLoading(false)
            return
        }
        setRows(res.data || [])
        setLoading(false)
    }, [live])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        return rows.filter((row) => {
            if (statusFilter && row.attendanceStatus !== statusFilter) return false
            if (search.trim()) {
                const q = search.trim().toLowerCase()
                const hay = `${row.employeeId} ${row.name} ${row.gate} ${row.date}`.toLowerCase()
                if (!hay.includes(q)) return false
            }
            return true
        })
    }, [rows, search, statusFilter])

    const save = async (event) => {
        event.preventDefault()
        if (!form.name.trim() || !form.date.trim()) {
            toast.error('Name and date are required.')
            return
        }
        setSaving(true)
        const saved = await upsertGateTeamAttendance(form)
        setSaving(false)
        if (!saved.success) {
            toast.error(saved.error || 'Could not save attendance on the server.')
            return
        }
        setRows(saved.rows || [])
        setModalOpen(false)
        setForm(emptyForm)
        toast.success('Attendance row saved on the server')
    }

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Gatekeepers attendance uses GET/PUT /api/v1/ops/gate-team-attendance.'
            />
        )
    }

    return (
        <section className='space-y-4'>
            {!error && !loading ? (
                <IntegrationNotice
                    state='connected'
                    title='Gatekeepers attendance is live'
                    description='GET/PUT /api/v1/ops/gate-team-attendance. Static mock list removed.'
                />
            ) : null}
            {error ? <IntegrationNotice state='failed' title='API failed' description={error} /> : null}

            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                    <h1 className='text-xl font-semibold text-slate-900'>Gatekeepers attendance</h1>
                    <p className='text-xs text-slate-500'>Live ops collection · no mock seed</p>
                </div>
                <button
                    type='button'
                    onClick={() => {
                        setForm(emptyForm)
                        setModalOpen(true)
                    }}
                    className='inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white'
                >
                    <Plus size={16} /> Add attendance
                </button>
            </div>

            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder='Search name, ID, gate…'
                    className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
                >
                    <option value=''>All statuses</option>
                    {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status}</option>
                    ))}
                </select>
            </div>

            <div className='overflow-x-auto rounded-2xl border border-slate-200 bg-white'>
                {loading ? (
                    <p className='p-6 text-sm text-slate-500'>Loading…</p>
                ) : (
                    <table className='w-full text-sm'>
                        <thead className='bg-slate-50 text-xs uppercase text-slate-600'>
                            <tr>
                                <th className='px-3 py-3 text-left'>Employee ID</th>
                                <th className='px-3 py-3 text-left'>Name</th>
                                <th className='px-3 py-3 text-left'>Gate</th>
                                <th className='px-3 py-3 text-left'>Date</th>
                                <th className='px-3 py-3 text-left'>In</th>
                                <th className='px-3 py-3 text-left'>Out</th>
                                <th className='px-3 py-3 text-left'>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((row) => (
                                <tr key={row.id} className='border-t border-slate-100'>
                                    <td className='px-3 py-3'>{row.employeeId || '—'}</td>
                                    <td className='px-3 py-3 font-medium'>{row.name || '—'}</td>
                                    <td className='px-3 py-3'>{row.gate || '—'}</td>
                                    <td className='px-3 py-3'>{row.date || '—'}</td>
                                    <td className='px-3 py-3'>{row.inTime || '—'}</td>
                                    <td className='px-3 py-3'>{row.outTime || '—'}</td>
                                    <td className='px-3 py-3'>{row.attendanceStatus || '—'}</td>
                                </tr>
                            ))}
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className='px-3 py-8 text-center text-slate-400'>
                                        No attendance rows on the server yet.
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                )}
            </div>

            {modalOpen ? (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
                    <div className='w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl'>
                        <div className='mb-4 flex items-center justify-between'>
                            <h2 className='text-lg font-semibold'>Add attendance</h2>
                            <button type='button' onClick={() => setModalOpen(false)} className='p-1 text-slate-500'>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={save} className='grid gap-3'>
                            {[
                                ['employeeId', 'Employee ID'],
                                ['name', 'Name'],
                                ['gate', 'Gate'],
                                ['date', 'Date'],
                                ['inTime', 'In time'],
                                ['outTime', 'Out time'],
                            ].map(([key, label]) => (
                                <label key={key} className='text-sm text-slate-600'>
                                    {label}
                                    <input
                                        value={form[key]}
                                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                                        className='mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
                                    />
                                </label>
                            ))}
                            <label className='text-sm text-slate-600'>
                                Status
                                <select
                                    value={form.attendanceStatus}
                                    onChange={(e) => setForm((prev) => ({ ...prev, attendanceStatus: e.target.value }))}
                                    className='mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
                                >
                                    {STATUS_OPTIONS.map((status) => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                            </label>
                            <button
                                type='submit'
                                disabled={saving}
                                className='mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60'
                            >
                                <CheckCircle2 size={16} /> {saving ? 'Saving…' : 'Save on server'}
                            </button>
                        </form>
                    </div>
                </div>
            ) : null}
        </section>
    )
}

export default GatekeepersAttendance
