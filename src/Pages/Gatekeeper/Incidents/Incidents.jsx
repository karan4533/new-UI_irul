import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { toast } from 'react-toastify'
import { DataTable, DataToolbar, FeedbackState, IntegrationNotice, StatusBadge } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listGateIncidents, upsertGateIncident } from '../../../services/api/gateApiService'

const priorityRank = { Critical: 0, High: 1, Medium: 2, Low: 3 }
const filterClass = 'min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm text-[var(--erp-ink)]'

const Incidents = () => {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')
    const [query, setQuery] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('All')
    const [statusFilter, setStatusFilter] = useState('All')
    const [savingId, setSavingId] = useState('')

    const load = useCallback(async () => {
        if (!live) {
            setRows([])
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const res = await listGateIncidents()
        if (!res.success) {
            setRows([])
            setError(res.error || 'Failed to load /api/v1/ops/gate-incidents.')
            setLoading(false)
            return
        }
        setRows(res.data || [])
        setLoading(false)
    }, [live])

    useEffect(() => {
        load()
    }, [load])

    const visibleRows = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()
        return rows
            .filter((incident) => {
                const searchable = Object.values(incident).filter((value) => typeof value !== 'object').join(' ').toLowerCase()
                return (
                    (!normalizedQuery || searchable.includes(normalizedQuery)) &&
                    (priorityFilter === 'All' || incident.priority === priorityFilter) &&
                    (statusFilter === 'All' || incident.status === statusFilter)
                )
            })
            .sort((left, right) => (priorityRank[left.priority] ?? 9) - (priorityRank[right.priority] ?? 9))
    }, [priorityFilter, query, rows, statusFilter])

    const advanceStatus = async (incident) => {
        const order = ['Open', 'Acknowledged', 'In Progress', 'Resolved', 'Closed']
        const idx = order.indexOf(incident.status)
        const nextStatus = order[Math.min(idx + 1, order.length - 1)]
        if (nextStatus === incident.status) return
        setSavingId(incident.id)
        const saved = await upsertGateIncident({ ...incident, status: nextStatus })
        setSavingId('')
        if (!saved.success) {
            toast.error(saved.error || 'Could not update incident on the server.')
            return
        }
        setRows(saved.rows || [])
        toast.success(`Incident ${incident.id} → ${nextStatus}`)
    }

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Incidents use GET/PUT /api/v1/ops/gate-incidents.'
            />
        )
    }

    const columns = [
        { key: 'id', label: 'Incident', required: true },
        {
            key: 'incidentType',
            label: 'Type',
            required: true,
            render: (incident) => (
                <div>
                    <p className='font-semibold text-[var(--erp-ink)]'>{incident.incidentType || '—'}</p>
                    <p className='mt-0.5 max-w-sm text-xs text-[var(--erp-muted)]'>{incident.description}</p>
                </div>
            ),
        },
        { key: 'occurred', label: 'Occurred', render: (incident) => `${incident.date || '—'} · ${incident.time || '—'}` },
        { key: 'location', label: 'Location' },
        { key: 'reportedBy', label: 'Reported by' },
        { key: 'assignedTo', label: 'Assigned to', required: true },
        { key: 'priority', label: 'Priority', required: true, render: (incident) => <StatusBadge status={incident.priority} /> },
        { key: 'status', label: 'Status', required: true, render: (incident) => <StatusBadge status={incident.status} /> },
        {
            key: 'actions',
            label: 'Actions',
            render: (incident) => (
                <div className='flex gap-2'>
                    <Link to={`/gate-keeper/incidents/${incident.id}`} className='text-xs font-semibold text-[var(--erp-indigo)]'>
                        View
                    </Link>
                    <button
                        type='button'
                        disabled={savingId === incident.id}
                        onClick={() => advanceStatus(incident)}
                        className='text-xs font-semibold text-[var(--erp-indigo)]'
                    >
                        Advance
                    </button>
                </div>
            ),
        },
    ]

    return (
        <section className='space-y-5'>
            <div className='rounded-2xl bg-white p-4 shadow-md sm:p-5'>
                <h2 className='text-xl font-semibold text-[var(--erp-ink)]'>Security incident register</h2>
                <p className='mt-1 text-sm text-[var(--erp-slate)]'>
                    Report and track gate security incidents persisted on /api/v1/ops/gate-incidents.
                </p>
                <IntegrationNotice
                    state='connected'
                    className='mt-4'
                    title='Live gate incidents'
                    description='Statuses save through full-collection PUT. Shared browser demoDomain incident store is not used on this page.'
                />
            </div>
            <div className='overflow-hidden rounded-2xl bg-white shadow-md'>
                <DataToolbar
                    query={query}
                    onQueryChange={setQuery}
                    searchLabel='Search security incidents'
                    searchPlaceholder='Search incident, place, reporter or assignee…'
                    actions={(
                        <div className='flex flex-wrap gap-2'>
                            <select className={filterClass} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                                <option value='All'>All priorities</option>
                                {[...new Set(rows.map((r) => r.priority).filter(Boolean))].map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                ))}
                            </select>
                            <select className={filterClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                <option value='All'>All statuses</option>
                                {[...new Set(rows.map((r) => r.status).filter(Boolean))].map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                ))}
                            </select>
                            <button type='button' onClick={load} className='min-h-10 rounded-lg border border-[var(--erp-indigo)] px-4 text-sm font-semibold text-[var(--erp-indigo)]'>
                                Refresh
                            </button>
                            <Link to='/gate-keeper/add-incident' className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white'>
                                <Plus size={16} /> Add incident
                            </Link>
                        </div>
                    )}
                />
                {loading ? (
                    <p className='p-6 text-sm text-slate-500'>Loading incidents…</p>
                ) : error ? (
                    <div className='p-4'>
                        <FeedbackState kind='error' title='Could not load incidents' description={error} />
                    </div>
                ) : (
                    <DataTable columns={columns} rows={visibleRows} emptyMessage='No gate incidents on the server yet.' />
                )}
            </div>
        </section>
    )
}

export default Incidents
