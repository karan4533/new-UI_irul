import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, X, CheckCircle2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { FeedbackState, IntegrationNotice } from '../../Common/ui'
import { isLiveApiEnabled } from '../../services/api/tokenStore'
import {
    listGateHandover,
    listGateRegisters,
    listGateVendors,
    upsertGateHandover,
    upsertGateRegister,
    upsertGateVendor,
} from '../../services/api/gateApiService'

const CONFIG = {
    registers: {
        title: 'Gate registers',
        pathLabel: 'GET/PUT /api/v1/ops/gate-registers',
        list: listGateRegisters,
        upsert: upsertGateRegister,
        fields: [
            ['title', 'Register title'],
            ['category', 'Category'],
            ['notes', 'Notes'],
            ['status', 'Status'],
        ],
        required: ['title'],
    },
    handover: {
        title: 'Shift handover',
        pathLabel: 'GET/PUT /api/v1/ops/gate-handover',
        list: listGateHandover,
        upsert: upsertGateHandover,
        fields: [
            ['title', 'Handover summary'],
            ['fromShift', 'From shift'],
            ['toShift', 'To shift'],
            ['notes', 'Notes'],
            ['status', 'Status'],
        ],
        required: ['title'],
    },
    vendors: {
        title: 'Vendor entry log',
        pathLabel: 'GET/PUT /api/v1/ops/gate-vendors',
        list: listGateVendors,
        upsert: upsertGateVendor,
        fields: [
            ['title', 'Vendor name'],
            ['purpose', 'Purpose'],
            ['vehicleNumber', 'Vehicle number'],
            ['notes', 'Notes'],
            ['status', 'Status'],
        ],
        required: ['title'],
    },
}

export default function GateOpsCollectionLive({ kind = 'registers' }) {
    const live = isLiveApiEnabled()
    const cfg = CONFIG[kind] || CONFIG.registers
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({})

    const emptyForm = useMemo(() => {
        const next = {}
        cfg.fields.forEach(([key]) => {
            next[key] = key === 'status' ? 'Open' : ''
        })
        return next
    }, [cfg])

    const load = useCallback(async () => {
        if (!live) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const res = await cfg.list()
        if (!res.success) {
            setRows([])
            setError(res.error || `Failed to load ${cfg.pathLabel}.`)
            setLoading(false)
            return
        }
        setRows(res.data || [])
        setLoading(false)
    }, [live, cfg])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        if (!search.trim()) return rows
        const q = search.trim().toLowerCase()
        return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q))
    }, [rows, search])

    const save = async (event) => {
        event.preventDefault()
        for (const key of cfg.required) {
            if (!String(form[key] || '').trim()) {
                toast.error(`${key} is required.`)
                return
            }
        }
        setSaving(true)
        const saved = await cfg.upsert(form)
        setSaving(false)
        if (!saved.success) {
            toast.error(saved.error || 'Could not save on the server.')
            return
        }
        setRows(saved.rows || [])
        setModalOpen(false)
        setForm(emptyForm)
        toast.success(`${cfg.title} row saved on the server`)
    }

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description={`${cfg.title} uses ${cfg.pathLabel}.`}
            />
        )
    }

    return (
        <section className='space-y-4'>
            {!error && !loading ? (
                <IntegrationNotice
                    state='connected'
                    title={`${cfg.title} is live`}
                    description={`${cfg.pathLabel}. No localStorage / mock seed.`}
                />
            ) : null}
            {error ? <IntegrationNotice state='failed' title='API failed' description={error} /> : null}

            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                <div>
                    <h1 className='text-xl font-semibold text-slate-900'>{cfg.title}</h1>
                    <p className='text-xs text-slate-500'>{cfg.pathLabel}</p>
                </div>
                <button
                    type='button'
                    onClick={() => {
                        setForm(emptyForm)
                        setModalOpen(true)
                    }}
                    className='inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white'
                >
                    <Plus size={16} /> Add row
                </button>
            </div>

            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search…'
                className='w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
            />

            <div className='overflow-x-auto rounded-2xl border border-slate-200 bg-white'>
                {loading ? (
                    <p className='p-6 text-sm text-slate-500'>Loading…</p>
                ) : (
                    <table className='w-full text-sm'>
                        <thead className='bg-slate-50 text-xs uppercase text-slate-600'>
                            <tr>
                                <th className='px-3 py-3 text-left'>ID</th>
                                <th className='px-3 py-3 text-left'>Title</th>
                                <th className='px-3 py-3 text-left'>Status</th>
                                <th className='px-3 py-3 text-left'>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((row) => (
                                <tr key={row.id} className='border-t border-slate-100'>
                                    <td className='px-3 py-3 font-mono text-xs'>{row.id}</td>
                                    <td className='px-3 py-3 font-medium'>{row.title || '—'}</td>
                                    <td className='px-3 py-3'>{row.status || '—'}</td>
                                    <td className='px-3 py-3'>{row.notes || '—'}</td>
                                </tr>
                            ))}
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className='px-3 py-8 text-center text-slate-400'>
                                        No rows on the server yet.
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
                            <h2 className='text-lg font-semibold'>Add {cfg.title}</h2>
                            <button type='button' onClick={() => setModalOpen(false)} className='p-1 text-slate-500'>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={save} className='grid gap-3'>
                            {cfg.fields.map(([key, label]) => (
                                <label key={key} className='text-sm text-slate-600'>
                                    {label}
                                    <input
                                        value={form[key] || ''}
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
                                <CheckCircle2 size={16} /> {saving ? 'Saving…' : 'Save on server'}
                            </button>
                        </form>
                    </div>
                </div>
            ) : null}
        </section>
    )
}
