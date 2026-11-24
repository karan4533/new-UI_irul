import React, { useEffect, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { FeedbackState, IntegrationNotice, StatusBadge } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listGateIncidents } from '../../../services/api/gateApiService'

const ViewIncident = () => {
    const { id } = useParams()
    const live = isLiveApiEnabled()
    const [incident, setIncident] = useState(null)
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            if (!live) {
                setLoading(false)
                setError('Live API is disabled.')
                return
            }
            setLoading(true)
            const res = await listGateIncidents()
            if (cancelled) return
            if (!res.success) {
                setError(res.error || 'Failed to load incidents.')
                setIncident(null)
                setLoading(false)
                return
            }
            const found = (res.data || []).find((row) => String(row.id) === String(id)) || null
            setIncident(found)
            setError(found ? '' : 'Incident not found on the server.')
            setLoading(false)
        }
        run()
        return () => {
            cancelled = true
        }
    }, [id, live])

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Incident detail uses GET /api/v1/ops/gate-incidents.'
            />
        )
    }
    if (loading) return <p className='text-sm text-slate-500 p-4'>Loading incident…</p>
    if (!incident) {
        return (
            <FeedbackState
                kind='empty'
                title='Incident not found'
                description={error || 'The incident may have been removed or the link is invalid.'}
                action={<NavLink className='text-[var(--erp-indigo)]' to='/gate-keeper/incidents'>Back to incidents</NavLink>}
            />
        )
    }

    return (
        <section className='space-y-5'>
            <div className='rounded-2xl bg-white p-4 shadow-md sm:p-5'>
                <NavLink to='/gate-keeper/incidents' className='text-sm font-semibold text-[var(--erp-indigo)]'>← Back to incidents</NavLink>
                <div className='mt-4 flex flex-wrap items-center gap-2'>
                    <h2 className='mr-auto text-xl font-semibold text-[var(--erp-ink)]'>{incident.id} · {incident.incidentType}</h2>
                    <StatusBadge status={incident.priority} />
                    <StatusBadge status={incident.status} />
                </div>
                <p className='mt-2 text-sm text-[var(--erp-slate)]'>{incident.description}</p>
                <IntegrationNotice
                    state='connected'
                    className='mt-4'
                    title='Server-backed safety record'
                    description='Loaded from campus ops gate-incidents. Append-only legal evidence still requires a dedicated audit API.'
                />
            </div>
            <div className='rounded-2xl bg-white p-4 shadow-md sm:p-5'>
                <h3 className='font-semibold text-[var(--erp-ink)]'>Response context</h3>
                <dl className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                    {[
                        ['Occurred', `${incident.date || '—'} · ${incident.time || '—'}`],
                        ['Location', incident.location || '—'],
                        ['Reported by', incident.reportedBy || '—'],
                        ['Assigned to', incident.assignedTo || '—'],
                        ['Priority', incident.priority || '—'],
                        ['Status', incident.status || '—'],
                    ].map(([label, value]) => (
                        <div key={label} className='rounded-xl border border-[var(--erp-line)] p-3'>
                            <dt className='text-xs font-semibold uppercase tracking-wide text-[var(--erp-muted)]'>{label}</dt>
                            <dd className='mt-1 text-sm font-medium text-[var(--erp-ink)]'>{value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </section>
    )
}

export default ViewIncident
