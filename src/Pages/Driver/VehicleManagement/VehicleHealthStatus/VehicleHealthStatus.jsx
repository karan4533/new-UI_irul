import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Download, Plus } from 'lucide-react'
import ExportModal from '../../../../Common/CommonComponents/ExportModal'
import { FeedbackState } from '../../../../Common/ui'
import { isLiveApiEnabled } from '../../../../services/api/tokenStore'
import { listTransportVehicleHealth } from '../../../../services/api/transportApiService'

const VehicleHealthStatus = () => {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [exportModal, setExportModal] = useState(false)

    const load = useCallback(async () => {
        if (!live) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        const res = await listTransportVehicleHealth()
        if (!res.success) {
            setRows([])
            setError(res.error || 'Failed to load vehicle health.')
            setLoading(false)
            return
        }
        setRows(res.data || [])
        setError('')
        setLoading(false)
    }, [live])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        if (!search.trim()) return rows
        const q = search.toLowerCase()
        return rows.filter((r) => `${r.id} ${r.vehicleNumber} ${r.engineStatus} ${r.overallCondition}`.toLowerCase().includes(q))
    }, [rows, search])

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Vehicle health uses GET/PUT /api/v1/ops/transport-vehicle-health.'
            />
        )
    }

    return (
        <section className='space-y-6'>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Search health records…' className='text-sm border border-[#D9D9D9] rounded-md px-3 py-2 w-full sm:max-w-sm' />
                    <div className='flex gap-2'>
                        <button type='button' onClick={load} className='text-sm border border-[#515DEF] text-[#515DEF] px-4 py-2 rounded-md'>Refresh</button>
                        <NavLink to='/driver/vehicle-management/vehicle-health-status/add' className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md inline-flex items-center gap-2'>
                            <Plus size={16} /> Add
                        </NavLink>
                        <button type='button' onClick={() => setExportModal(true)} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md inline-flex items-center gap-2'>
                            <Download size={16} /> Export
                        </button>
                    </div>
                </div>
            </div>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-medium text-black mb-4'>Vehicle Health Status</h2>
                {loading ? (
                    <p className='text-sm text-slate-500 py-8 text-center'>Loading…</p>
                ) : error ? (
                    <FeedbackState kind='error' title='Could not load health records' description={error} />
                ) : (
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm'>
                            <thead className='text-xs bg-[#EDEEF5]'>
                                <tr>
                                    <th className='px-2 py-3 text-left'>ID</th>
                                    <th className='px-2 py-3 text-left'>Vehicle</th>
                                    <th className='px-2 py-3 text-left'>Date</th>
                                    <th className='px-2 py-3 text-left'>Engine</th>
                                    <th className='px-2 py-3 text-left'>Tyres</th>
                                    <th className='px-2 py-3 text-left'>Overall</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((row) => (
                                    <tr key={row.id} className='border-b border-[#f2f4f7]'>
                                        <td className='px-2 py-3 font-mono'>{row.id}</td>
                                        <td className='px-2 py-3'>{row.vehicleNumber || '—'}</td>
                                        <td className='px-2 py-3'>{row.inspectionDate || '—'}</td>
                                        <td className='px-2 py-3'>{row.engineStatus || '—'}</td>
                                        <td className='px-2 py-3'>{row.tyreCondition || '—'}</td>
                                        <td className='px-2 py-3'>{row.overallCondition || '—'}</td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className='text-center py-8 text-slate-400'>No health records on the server yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <ExportModal exportModal={exportModal} setExportModal={setExportModal} />
        </section>
    )
}

export default VehicleHealthStatus
