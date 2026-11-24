import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { FeedbackState, IntegrationNotice } from '../../Common/ui'
import { isLiveApiEnabled } from '../../services/api/tokenStore'
import { listStudentGatePassesLive } from '../../services/api/gateApiService'

export default function StudentGatePassesLive() {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')

    const load = useCallback(async () => {
        if (!live) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const res = await listStudentGatePassesLive()
        if (!res.success) {
            setRows([])
            setError(res.error || 'Failed to load student gate passes.')
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
        if (!search.trim()) return rows
        const q = search.trim().toLowerCase()
        return rows.filter((row) =>
            `${row.gatePassId} ${row.studentName} ${row.classSection} ${row.finalStatus}`.toLowerCase().includes(q)
        )
    }, [rows, search])

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Student gate passes use GET /api/v1/front-office/student-gate-passes (read-only for Gate Keeper).'
            />
        )
    }

    return (
        <section className='space-y-4'>
            {!error && !loading ? (
                <IntegrationNotice
                    state='connected'
                    title='Student gate passes are live (read-only)'
                    description='GET /api/v1/front-office/student-gate-passes. Create/update stays PRM/admin only — no mock write fallback.'
                />
            ) : null}
            {error ? <IntegrationNotice state='failed' title='API failed' description={error} /> : null}
            <div>
                <h1 className='text-xl font-semibold text-slate-900'>Student gate passes</h1>
                <p className='text-xs text-slate-500'>Live FO collection · Gate Keeper read-only</p>
            </div>
            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search student / pass…'
                className='w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
            />
            <div className='overflow-x-auto rounded-2xl border border-slate-200 bg-white'>
                {loading ? (
                    <p className='p-6 text-sm text-slate-500'>Loading…</p>
                ) : (
                    <table className='w-full text-sm'>
                        <thead className='bg-slate-50 text-xs uppercase text-slate-600'>
                            <tr>
                                <th className='px-3 py-3 text-left'>Pass ID</th>
                                <th className='px-3 py-3 text-left'>Student</th>
                                <th className='px-3 py-3 text-left'>Class</th>
                                <th className='px-3 py-3 text-left'>Leave</th>
                                <th className='px-3 py-3 text-left'>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((row) => (
                                <tr key={row.id || row.gatePassId} className='border-t border-slate-100'>
                                    <td className='px-3 py-3 font-mono text-xs'>{row.gatePassId || row.id}</td>
                                    <td className='px-3 py-3 font-medium'>{row.studentName || '—'}</td>
                                    <td className='px-3 py-3'>{row.classSection || '—'}</td>
                                    <td className='px-3 py-3'>{row.leaveType || '—'}</td>
                                    <td className='px-3 py-3'>{row.finalStatus || row.principalApproval || '—'}</td>
                                </tr>
                            ))}
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className='px-3 py-8 text-center text-slate-400'>
                                        No student gate passes on the server yet.
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                )}
            </div>
        </section>
    )
}
