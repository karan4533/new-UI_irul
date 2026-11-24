import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, ArrowRightLeft, AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    listGateDuties,
    listGateIncidents,
    listGateVisitors,
    listStudentGatePassesLive,
} from '../../../services/api/gateApiService'

export default function GateKeeperManagerDashboard() {
    const live = isLiveApiEnabled()
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')
    const [visitors, setVisitors] = useState([])
    const [studentPasses, setStudentPasses] = useState([])
    const [incidents, setIncidents] = useState([])
    const [duties, setDuties] = useState([])

    const load = useCallback(async () => {
        if (!live) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const [visRes, passRes, incRes, dutyRes] = await Promise.all([
            listGateVisitors(),
            listStudentGatePassesLive(),
            listGateIncidents(),
            listGateDuties(),
        ])
        setVisitors(visRes.success ? visRes.data || [] : [])
        setStudentPasses(passRes.success ? passRes.data || [] : [])
        setIncidents(incRes.success ? incRes.data || [] : [])
        setDuties(dutyRes.success ? dutyRes.data || [] : [])
        const parts = []
        if (!visRes.success) parts.push(`visitors: ${visRes.error}`)
        if (!passRes.success) parts.push(`student passes: ${passRes.error}`)
        if (!incRes.success) parts.push(`incidents: ${incRes.error}`)
        if (!dutyRes.success) parts.push(`duties: ${dutyRes.error}`)
        setError(parts.length ? parts.join(' · ') : '')
        setLoading(false)
    }, [live])

    useEffect(() => {
        load()
    }, [load])

    const kpis = useMemo(() => {
        const activeVisitors = visitors.filter((v) => v.status === 'Checked In' || v.status === 'On Campus')
        const openIncidents = incidents.filter((i) => !['Resolved', 'Closed'].includes(String(i.status || '')))
        const openDuties = duties.filter((d) => d.status !== 'Completed')
        return {
            visitorsInside: activeVisitors.length,
            studentPasses: studentPasses.length,
            openIncidents: openIncidents.length,
            openDuties: openDuties.length,
        }
    }, [visitors, studentPasses, incidents, duties])

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Gate Keeper Manager dashboard uses ops gate-* and FO student-gate-passes.'
            />
        )
    }

    return (
        <section className='space-y-6'>
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                <div>
                    <h1 className='text-xl font-bold tracking-tight text-slate-900'>
                        Gatekeeper Manager Operations &amp; Audit Desk
                    </h1>
                    <p className='text-xs text-slate-500'>
                        Central security oversight from live ops gate collections and front-office student gate passes (read-only).
                    </p>
                    <p className='mt-1 text-xs font-medium text-[#027A48]'>
                        Live · gate-visitors · gate-incidents · gate-duties · FO student-gate-passes
                    </p>
                </div>
                <button
                    type='button'
                    onClick={load}
                    className='rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition shadow-xs cursor-pointer'
                    title='Refresh Data'
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            <IntegrationNotice
                state='connected'
                title='FO gate-pass write remains PRM/admin'
                description='Manager can assign duties and advance incidents on ops. Student/hostel gate pass create/update stays PRM/admin (403 for gate roles).'
            />

            {loading ? <p className='text-sm text-slate-500'>Loading live gate manager data…</p> : null}
            {error ? <FeedbackState kind='error' title='Partial load issues' description={error} /> : null}

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center justify-between'>
                    <div>
                        <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Visitors Inside</p>
                        <h3 className='text-2xl font-bold text-slate-900 mt-1'>{kpis.visitorsInside}</h3>
                    </div>
                    <div className='rounded-xl bg-blue-50 p-3 text-blue-600'><Users size={22} /></div>
                </div>
                <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center justify-between'>
                    <div>
                        <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Student Passes (FO)</p>
                        <h3 className='text-2xl font-bold text-slate-900 mt-1'>{kpis.studentPasses}</h3>
                    </div>
                    <div className='rounded-xl bg-emerald-50 p-3 text-emerald-600'><ArrowRightLeft size={22} /></div>
                </div>
                <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center justify-between'>
                    <div>
                        <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Open Incidents</p>
                        <h3 className='text-2xl font-bold text-slate-900 mt-1'>{kpis.openIncidents}</h3>
                    </div>
                    <div className='rounded-xl bg-amber-50 p-3 text-amber-600'><AlertTriangle size={22} /></div>
                </div>
                <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center justify-between'>
                    <div>
                        <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Open Duties</p>
                        <h3 className='text-2xl font-bold text-slate-900 mt-1'>{kpis.openDuties}</h3>
                    </div>
                    <div className='rounded-xl bg-indigo-50 p-3 text-indigo-600'><Clock size={22} /></div>
                </div>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                <div className='rounded-2xl bg-white border border-slate-200 shadow-xs p-4'>
                    <h2 className='text-base font-semibold text-slate-900 mb-3'>Recent duties</h2>
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm'>
                            <thead className='text-xs uppercase bg-slate-50 text-slate-600'>
                                <tr>
                                    <th className='px-2 py-2 text-left'>Duty</th>
                                    <th className='px-2 py-2 text-left'>Keeper</th>
                                    <th className='px-2 py-2 text-left'>Location</th>
                                    <th className='px-2 py-2 text-left'>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {duties.slice(0, 8).map((d) => (
                                    <tr key={d.id || d.dutyId} className='border-t border-slate-100'>
                                        <td className='px-2 py-3 font-mono'>{d.dutyId}</td>
                                        <td className='px-2 py-3'>{d.gateKeeperName || '—'}</td>
                                        <td className='px-2 py-3'>{d.gateLocation || '—'}</td>
                                        <td className='px-2 py-3'>{d.status}</td>
                                    </tr>
                                ))}
                                {duties.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className='px-2 py-6 text-center text-slate-400'>No duties on the server.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className='rounded-2xl bg-white border border-slate-200 shadow-xs p-4'>
                    <h2 className='text-base font-semibold text-slate-900 mb-3'>Open incidents</h2>
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm'>
                            <thead className='text-xs uppercase bg-slate-50 text-slate-600'>
                                <tr>
                                    <th className='px-2 py-2 text-left'>ID</th>
                                    <th className='px-2 py-2 text-left'>Type</th>
                                    <th className='px-2 py-2 text-left'>Priority</th>
                                    <th className='px-2 py-2 text-left'>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {incidents.filter((i) => !['Resolved', 'Closed'].includes(String(i.status || ''))).slice(0, 8).map((i) => (
                                    <tr key={i.id} className='border-t border-slate-100'>
                                        <td className='px-2 py-3 font-mono'>{i.id}</td>
                                        <td className='px-2 py-3'>{i.incidentType || '—'}</td>
                                        <td className='px-2 py-3'>{i.priority}</td>
                                        <td className='px-2 py-3'>{i.status}</td>
                                    </tr>
                                ))}
                                {incidents.filter((i) => !['Resolved', 'Closed'].includes(String(i.status || ''))).length === 0 && (
                                    <tr>
                                        <td colSpan={4} className='px-2 py-6 text-center text-slate-400'>No open incidents.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    )
}
