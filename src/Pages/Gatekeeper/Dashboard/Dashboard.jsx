import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, ArrowRightLeft, AlertTriangle, ShieldCheck, RefreshCw, LogOut } from 'lucide-react'
import { toast } from 'react-toastify'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    listGateIncidents,
    listGateVisitors,
    listStudentGatePassesLive,
    upsertGateVisitor,
} from '../../../services/api/gateApiService'

export default function GatekeeperDashboard() {
    const live = isLiveApiEnabled()
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')
    const [visitors, setVisitors] = useState([])
    const [studentPasses, setStudentPasses] = useState([])
    const [incidents, setIncidents] = useState([])
    const [visitorSearch, setVisitorSearch] = useState('')
    const [studentSearch, setStudentSearch] = useState('')
    const [actionLoading, setActionLoading] = useState(false)

    const load = useCallback(async () => {
        if (!live) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const [visRes, passRes, incRes] = await Promise.all([
            listGateVisitors(),
            listStudentGatePassesLive(),
            listGateIncidents(),
        ])
        if (!visRes.success && !passRes.success && !incRes.success) {
            setError(visRes.error || passRes.error || incRes.error || 'Failed to load gate dashboard.')
            setVisitors([])
            setStudentPasses([])
            setIncidents([])
            setLoading(false)
            return
        }
        setVisitors(visRes.success ? visRes.data || [] : [])
        setStudentPasses(passRes.success ? passRes.data || [] : [])
        setIncidents(incRes.success ? incRes.data || [] : [])
        const parts = []
        if (!visRes.success) parts.push(`visitors: ${visRes.error}`)
        if (!passRes.success) parts.push(`student passes: ${passRes.error}`)
        if (!incRes.success) parts.push(`incidents: ${incRes.error}`)
        setError(parts.length ? parts.join(' · ') : '')
        setLoading(false)
    }, [live])

    useEffect(() => {
        load()
    }, [load])

    const kpis = useMemo(() => {
        const activeVisitors = visitors.filter((v) => v.status === 'Checked In' || v.status === 'On Campus')
        const actionablePasses = studentPasses.filter((p) =>
            ['Approved', 'Ready for Exit', 'Exit Recorded', 'Pending'].includes(String(p.finalStatus || p.principalApproval || ''))
        )
        const openIncidents = incidents.filter((i) => !['Resolved', 'Closed'].includes(String(i.status || '')))
        return {
            visitorsCurrentlyInside: activeVisitors.length,
            studentPassesAwaitingExit: actionablePasses.length,
            openIncidents: openIncidents.length,
            totalStudentPasses: studentPasses.length,
        }
    }, [visitors, studentPasses, incidents])

    const filteredVisitors = useMemo(() => {
        const q = visitorSearch.trim().toLowerCase()
        const list = visitors.filter((v) => v.status === 'Checked In' || v.status === 'On Campus')
        if (!q) return list
        return list.filter((v) =>
            [v.visitorName, v.personToMeet, v.department, v.phone, v.id].some((val) =>
                String(val || '').toLowerCase().includes(q)
            )
        )
    }, [visitors, visitorSearch])

    const filteredStudentPasses = useMemo(() => {
        const q = studentSearch.trim().toLowerCase()
        if (!q) return studentPasses
        return studentPasses.filter((p) =>
            [p.studentName, p.studentId, p.classSection, p.gatePassId, p.id].some((val) =>
                String(val || '').toLowerCase().includes(q)
            )
        )
    }, [studentPasses, studentSearch])

    const handleVisitorCheckout = async (visitor) => {
        setActionLoading(true)
        const saved = await upsertGateVisitor({
            ...visitor,
            status: 'Checked Out',
            checkOutAt: new Date().toISOString(),
        })
        setActionLoading(false)
        if (!saved.success) {
            toast.error(saved.error || 'Could not check out visitor on the server.')
            return
        }
        setVisitors(saved.rows || [])
        toast.success(`Visitor ${visitor.visitorName || visitor.id} checked out on the server`)
    }

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Gate Keeper dashboard uses /api/v1/ops/gate-visitors|gate-incidents and FO student-gate-passes.'
            />
        )
    }

    return (
        <section className='space-y-6'>
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                <div>
                    <h1 className='text-xl font-bold tracking-tight text-slate-900'>Gatekeeper Command Dashboard</h1>
                    <p className='text-xs text-slate-500'>
                        Live campus perimeter terminal using ops gate collections and front-office student gate passes (read-only).
                    </p>
                    <p className='mt-1 text-xs font-medium text-[#027A48]'>
                        Live · /api/v1/ops/gate-visitors · /api/v1/ops/gate-incidents · FO student-gate-passes
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
                title='Student exit/return write blocked for Gate Keeper'
                description='Student gate passes are listed from front-office (read). Create/update is PRM/admin only. Visitor check-out and incidents use ops gate-* PUT.'
            />

            {loading ? <p className='text-sm text-slate-500'>Loading live gate data…</p> : null}
            {error ? <FeedbackState kind='error' title='Partial load issues' description={error} /> : null}

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center justify-between'>
                    <div>
                        <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Visitors Currently Inside</p>
                        <h3 className='text-2xl font-bold text-slate-900 mt-1'>{kpis.visitorsCurrentlyInside}</h3>
                    </div>
                    <div className='rounded-xl bg-blue-50 p-3 text-blue-600'><Users size={22} /></div>
                </div>
                <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center justify-between'>
                    <div>
                        <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Student Passes (FO)</p>
                        <h3 className='text-2xl font-bold text-slate-900 mt-1'>{kpis.totalStudentPasses}</h3>
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
                        <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Actionable FO Passes</p>
                        <h3 className='text-2xl font-bold text-slate-900 mt-1'>{kpis.studentPassesAwaitingExit}</h3>
                    </div>
                    <div className='rounded-xl bg-indigo-50 p-3 text-indigo-600'><ShieldCheck size={22} /></div>
                </div>
            </div>

            <div id='visitors-section' className='rounded-2xl bg-white border border-slate-200 shadow-xs p-4'>
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3'>
                    <h2 className='text-base font-semibold text-slate-900'>Active visitors (ops)</h2>
                    <input
                        value={visitorSearch}
                        onChange={(e) => setVisitorSearch(e.target.value)}
                        placeholder='Search visitors…'
                        className='text-sm border border-slate-200 rounded-lg px-3 py-2 w-full sm:max-w-xs'
                    />
                </div>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead className='text-xs uppercase bg-slate-50 text-slate-600'>
                            <tr>
                                <th className='px-2 py-2 text-left'>Visitor</th>
                                <th className='px-2 py-2 text-left'>Meet</th>
                                <th className='px-2 py-2 text-left'>Purpose</th>
                                <th className='px-2 py-2 text-left'>Status</th>
                                <th className='px-2 py-2 text-left'>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVisitors.map((v) => (
                                <tr key={v.id} className='border-t border-slate-100'>
                                    <td className='px-2 py-3 font-medium'>{v.visitorName || v.id}</td>
                                    <td className='px-2 py-3'>{v.personToMeet || '—'}</td>
                                    <td className='px-2 py-3'>{v.purpose || '—'}</td>
                                    <td className='px-2 py-3'>{v.status}</td>
                                    <td className='px-2 py-3'>
                                        <button
                                            type='button'
                                            disabled={actionLoading}
                                            onClick={() => handleVisitorCheckout(v)}
                                            className='inline-flex items-center gap-1 text-xs font-semibold text-indigo-600'
                                        >
                                            <LogOut size={14} /> Check out
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredVisitors.length === 0 && (
                                <tr>
                                    <td colSpan={5} className='px-2 py-6 text-center text-slate-400'>No active visitors on the server.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div id='student-passes-section' className='rounded-2xl bg-white border border-slate-200 shadow-xs p-4'>
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3'>
                    <h2 className='text-base font-semibold text-slate-900'>Student gate passes (FO read-only)</h2>
                    <input
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder='Search student passes…'
                        className='text-sm border border-slate-200 rounded-lg px-3 py-2 w-full sm:max-w-xs'
                    />
                </div>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead className='text-xs uppercase bg-slate-50 text-slate-600'>
                            <tr>
                                <th className='px-2 py-2 text-left'>Pass ID</th>
                                <th className='px-2 py-2 text-left'>Student</th>
                                <th className='px-2 py-2 text-left'>Class</th>
                                <th className='px-2 py-2 text-left'>Reason</th>
                                <th className='px-2 py-2 text-left'>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudentPasses.map((p) => (
                                <tr key={p.id || p.gatePassId} className='border-t border-slate-100'>
                                    <td className='px-2 py-3 font-mono'>{p.gatePassId || p.id}</td>
                                    <td className='px-2 py-3'>{p.studentName || '—'}</td>
                                    <td className='px-2 py-3'>{p.classSection || '—'}</td>
                                    <td className='px-2 py-3'>{p.leaveType || '—'}</td>
                                    <td className='px-2 py-3'>{p.finalStatus || p.principalApproval || '—'}</td>
                                </tr>
                            ))}
                            {filteredStudentPasses.length === 0 && (
                                <tr>
                                    <td colSpan={5} className='px-2 py-6 text-center text-slate-400'>No student gate passes on the server.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    )
}
