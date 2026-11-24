import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, LogOut, X, CheckCircle2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listGateVisitors, upsertGateVisitor } from '../../../services/api/gateApiService'

const emptyForm = {
    visitorName: '',
    phone: '',
    personToMeet: '',
    department: '',
    purpose: '',
    visitorOrganization: '',
    idProofType: 'Aadhaar Card',
    idProofNumber: '',
    remarks: '',
}

export default function VisitorsLive() {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('All')
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        if (!live) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const res = await listGateVisitors()
        if (!res.success) {
            setRows([])
            setError(res.error || 'Failed to load /api/v1/ops/gate-visitors.')
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
        return rows.filter((v) => {
            if (statusFilter === 'Checked In' && v.status !== 'Checked In' && v.status !== 'On Campus') return false
            if (statusFilter === 'Checked Out' && v.status !== 'Checked Out') return false
            if (search.trim()) {
                const q = search.trim().toLowerCase()
                const hay = `${v.visitorName} ${v.id} ${v.phone} ${v.personToMeet} ${v.department} ${v.purpose}`.toLowerCase()
                if (!hay.includes(q)) return false
            }
            return true
        })
    }, [rows, search, statusFilter])

    const checkIn = async (event) => {
        event.preventDefault()
        if (!form.visitorName.trim() || !form.phone.trim() || !form.purpose.trim()) {
            toast.error('Visitor name, phone and purpose are required.')
            return
        }
        setSaving(true)
        const saved = await upsertGateVisitor({
            ...form,
            status: 'Checked In',
            checkInAt: new Date().toISOString(),
        })
        setSaving(false)
        if (!saved.success) {
            toast.error(saved.error || 'Could not check in visitor on the server.')
            return
        }
        setRows(saved.rows || [])
        setModalOpen(false)
        setForm(emptyForm)
        toast.success(`Visitor ${saved.data?.visitorName || saved.data?.id} checked in on the server`)
    }

    const checkOut = async (visitor) => {
        setSaving(true)
        const saved = await upsertGateVisitor({
            ...visitor,
            status: 'Checked Out',
            checkOutAt: new Date().toISOString(),
        })
        setSaving(false)
        if (!saved.success) {
            toast.error(saved.error || 'Could not check out visitor on the server.')
            return
        }
        setRows(saved.rows || [])
        toast.success(`Visitor ${visitor.visitorName || visitor.id} checked out on the server`)
    }

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Visitors use GET/PUT /api/v1/ops/gate-visitors.'
            />
        )
    }

    return (
        <section className='space-y-6'>
            {!error && !loading ? (
                <IntegrationNotice
                    state='connected'
                    title='Visitors are live'
                    description='GET/PUT /api/v1/ops/gate-visitors. Failures never fall back to localStorage.'
                />
            ) : null}
            {error ? <IntegrationNotice state='failed' title='Visitors API failed' description={error} /> : null}
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-bold text-slate-900'>Visitors</h1>
                    <p className='text-sm text-slate-500 mt-0.5'>Manage campus visitor check-in and check-out</p>
                </div>
                <button
                    type='button'
                    onClick={() => {
                        setForm(emptyForm)
                        setModalOpen(true)
                    }}
                    className='inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs'
                >
                    <Plus size={16} /> + New Check-in Visitor
                </button>
            </div>

            <div className='bg-white rounded-2xl border border-slate-200 shadow-xs p-4 grid grid-cols-1 md:grid-cols-3 gap-3'>
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder='Search visitors…'
                    className='text-sm border border-slate-200 rounded-lg px-3 py-2 md:col-span-2'
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className='text-sm border border-slate-200 rounded-lg px-3 py-2'
                >
                    <option value='All'>All statuses</option>
                    <option value='Checked In'>Checked In</option>
                    <option value='Checked Out'>Checked Out</option>
                </select>
            </div>

            <div className='bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden'>
                {loading ? (
                    <p className='p-6 text-sm text-slate-500'>Loading visitors…</p>
                ) : error ? (
                    <div className='p-4'>
                        <FeedbackState kind='error' title='Could not load visitors' description={error} />
                    </div>
                ) : (
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm'>
                            <thead className='bg-slate-50 text-xs uppercase text-slate-600'>
                                <tr>
                                    <th className='px-3 py-3 text-left'>ID</th>
                                    <th className='px-3 py-3 text-left'>Visitor</th>
                                    <th className='px-3 py-3 text-left'>Phone</th>
                                    <th className='px-3 py-3 text-left'>Meet</th>
                                    <th className='px-3 py-3 text-left'>Purpose</th>
                                    <th className='px-3 py-3 text-left'>Status</th>
                                    <th className='px-3 py-3 text-left'>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((v) => (
                                    <tr key={v.id} className='border-t border-slate-100'>
                                        <td className='px-3 py-3 font-mono text-xs'>{v.id}</td>
                                        <td className='px-3 py-3 font-medium'>{v.visitorName || '—'}</td>
                                        <td className='px-3 py-3'>{v.phone || '—'}</td>
                                        <td className='px-3 py-3'>{v.personToMeet || '—'}</td>
                                        <td className='px-3 py-3'>{v.purpose || '—'}</td>
                                        <td className='px-3 py-3'>{v.status}</td>
                                        <td className='px-3 py-3'>
                                            {(v.status === 'Checked In' || v.status === 'On Campus') ? (
                                                <button
                                                    type='button'
                                                    disabled={saving}
                                                    onClick={() => checkOut(v)}
                                                    className='inline-flex items-center gap-1 text-xs font-semibold text-indigo-600'
                                                >
                                                    <LogOut size={14} /> Check out
                                                </button>
                                            ) : (
                                                <span className='text-xs text-slate-400'>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className='px-3 py-8 text-center text-slate-400'>No visitors on the server yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modalOpen ? (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
                    <div className='w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl'>
                        <div className='flex items-center justify-between mb-4'>
                            <h2 className='text-lg font-semibold text-slate-900'>New visitor check-in</h2>
                            <button type='button' onClick={() => setModalOpen(false)} className='p-1 text-slate-500'>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={checkIn} className='grid grid-cols-1 gap-3'>
                            {[
                                ['visitorName', 'Visitor name'],
                                ['phone', 'Phone'],
                                ['personToMeet', 'Person to meet'],
                                ['department', 'Department'],
                                ['purpose', 'Purpose'],
                                ['visitorOrganization', 'Organization'],
                                ['idProofNumber', 'ID proof number'],
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
                            <button
                                type='submit'
                                disabled={saving}
                                className='mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60'
                            >
                                <CheckCircle2 size={16} /> {saving ? 'Saving…' : 'Check in on server'}
                            </button>
                        </form>
                    </div>
                </div>
            ) : null}
        </section>
    )
}
