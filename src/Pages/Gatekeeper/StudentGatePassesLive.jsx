import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { FeedbackState, IntegrationNotice } from '../../Common/ui'
import { isLiveApiEnabled } from '../../services/api/tokenStore'
import { listStudentGatePassesLive, verifyStudentGatePassSecurity } from '../../services/api/gateApiService'
import {
    getStudentGatePasses,
    recordStudentExit,
} from '../../Common/GatePassSecurity/gatePassSecurityData'

function canVerify(row) {
    const status = String(row.finalStatus || row.status || row.principalApproval || '').toLowerCase()
    if (row.securityVerifiedAt || status.includes('exit') || status.includes('verified')) return false
    return (
        status.includes('approv') ||
        status.includes('ready for exit') ||
        Boolean(row.approvedBy) ||
        Boolean(row.raw?.approvedBy)
    )
}

export default function StudentGatePassesLive() {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [busyId, setBusyId] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        if (!live) {
            const local = getStudentGatePasses().map((row) => ({
                id: row.id || row.gatePassId,
                gatePassId: row.gatePassId || row.id,
                studentName: row.studentName,
                classSection: row.classSection,
                leaveType: row.reason,
                finalStatus: row.status || row.displayStatus,
                securityVerifiedAt: row.securityVerifiedAt,
                securityVerifiedBy: row.securityVerifiedBy || row.exitGatekeeper,
                selectedApprovers: row.selectedApprovers || [],
                approvedBy: row.approvedBy,
                source: 'local',
                raw: row,
            }))
            setRows(local)
            setLoading(false)
            return
        }
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
            `${row.gatePassId} ${row.studentName} ${row.classSection} ${row.finalStatus}`.toLowerCase().includes(q),
        )
    }, [rows, search])

    const handleVerify = async (row) => {
        const id = row.id || row.gatePassId
        if (!canVerify(row)) {
            toast.error('Verify only after chosen approvers have sanctioned the pass.')
            return
        }
        setBusyId(id)
        try {
            if (!live) {
                recordStudentExit(id, 'Gate Keeper (Security)', '', 'Security identity verify at gate (client workflow).')
                toast.success('Security verified — exit recorded (local SoT).')
                await load()
                return
            }
            const res = await verifyStudentGatePassSecurity(id, { verifierName: 'Gate Keeper (Security)' })
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Security verify failed.')
                return
            }
            toast.success('Security verified at gate. Pass is Ready for Exit.')
            await load()
        } catch (err) {
            toast.error(err?.message || 'Security verify failed.')
        } finally {
            setBusyId('')
        }
    }

    return (
        <section className='space-y-4'>
            {!error && !loading ? (
                <IntegrationNotice
                    state={live ? 'connected' : 'mock'}
                    title={live ? 'Student gate passes — Security verify' : 'Local gate-pass SoT'}
                    description='Client workflow: requester chooses approvers → after approval, Security (Gate Keeper) verifies at the gate.'
                />
            ) : null}
            {error ? <IntegrationNotice state='failed' title='API failed' description={error} /> : null}
            <div>
                <h1 className='text-xl font-semibold text-slate-900'>Student gate passes</h1>
                <p className='text-xs text-slate-500'>
                    Security verify after sanction · {live ? 'Live FO collection' : 'Browser SoT'}
                </p>
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
                                <th className='px-3 py-3 text-left'>Security</th>
                                <th className='px-3 py-3 text-left'>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((row) => {
                                const id = row.id || row.gatePassId
                                const verified = Boolean(row.securityVerifiedAt || row.securityVerifiedBy)
                                return (
                                    <tr key={id} className='border-t border-slate-100'>
                                        <td className='px-3 py-3 font-mono text-xs'>{row.gatePassId || row.id}</td>
                                        <td className='px-3 py-3 font-medium'>{row.studentName || '—'}</td>
                                        <td className='px-3 py-3'>{row.classSection || '—'}</td>
                                        <td className='px-3 py-3'>{row.leaveType || '—'}</td>
                                        <td className='px-3 py-3'>{row.finalStatus || row.principalApproval || '—'}</td>
                                        <td className='px-3 py-3 text-xs'>
                                            {verified
                                                ? `Verified${row.securityVerifiedBy ? ` · ${row.securityVerifiedBy}` : ''}`
                                                : 'Awaiting Security'}
                                        </td>
                                        <td className='px-3 py-3'>
                                            <button
                                                type='button'
                                                disabled={!canVerify(row) || busyId === id}
                                                onClick={() => handleVerify(row)}
                                                className='rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40'
                                            >
                                                {busyId === id ? 'Verifying…' : 'Security verify'}
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className='px-3 py-8 text-center text-slate-400'>
                                        No student gate passes yet.
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                )}
            </div>
            {!live && !loading && rows.length === 0 ? (
                <FeedbackState
                    kind='empty'
                    title='No local gate passes'
                    description='Create a student gate pass from Front Office first, then approve it, then verify here.'
                />
            ) : null}
        </section>
    )
}
