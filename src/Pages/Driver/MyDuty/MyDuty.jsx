import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { toast } from 'react-toastify'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTransportDuties, upsertTransportDuty } from '../../../services/api/transportApiService'

const statusBadgeColor = {
    Scheduled: 'bg-[#2196F333] text-[#2196F3]',
    Pending: 'bg-[#FF980033] text-[#FF9800]',
    'In Progress': 'bg-[#2196F333] text-[#2196F3]',
    Assigned: 'bg-[#FF980033] text-[#FF9800]',
    Completed: 'bg-[#4CAF5033] text-[#4CAF50]',
    Started: 'bg-[#4CAF5033] text-[#4CAF50]',
}

const MyDuty = () => {
    const live = isLiveApiEnabled()
    const [duties, setDuties] = useState([])
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [fromDate, setFromDate] = useState(null)
    const [toDate, setToDate] = useState(null)
    const [exportModal, setExportModal] = useState(false)
    const [savingId, setSavingId] = useState('')

    const load = useCallback(async () => {
        if (!live) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const res = await listTransportDuties()
        if (!res.success) {
            setDuties([])
            setError(res.error || 'Failed to load /api/v1/ops/transport-duties.')
            setLoading(false)
            return
        }
        setDuties(res.data || [])
        setLoading(false)
    }, [live])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        return duties.filter((item) => {
            if (search.trim()) {
                const q = search.toLowerCase()
                const hay = `${item.id} ${item.routeName} ${item.vehicleNumber} ${item.shift}`.toLowerCase()
                if (!hay.includes(q)) return false
            }
            if (status && item.status !== status) return false
            return true
        })
    }, [duties, search, status])

    const updateStatus = async (duty, nextStatus) => {
        setSavingId(duty.id)
        const saved = await upsertTransportDuty({ ...duty, status: nextStatus })
        setSavingId('')
        if (!saved.success) {
            toast.error(saved.error || 'Could not update duty on the server.')
            return
        }
        setDuties(saved.rows || [])
        toast.success(`Duty ${duty.id} → ${nextStatus}`)
    }

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='My Duty uses GET/PUT /api/v1/ops/transport-duties (driver-scoped).'
            />
        )
    }

    return (
        <section className='space-y-6'>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between md:items-center md:flex-row flex-col gap-y-4'>
                    <button
                        type='button'
                        onClick={() => {
                            setSearch('')
                            setStatus('')
                            setFromDate(null)
                            setToDate(null)
                        }}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-2 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all cursor-pointer'
                    >
                        Clear Filters
                    </button>
                    <button type='button' onClick={load} className='text-sm font-medium text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2'>
                        Refresh
                    </button>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>Search</label>
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Duty ID, route, vehicle...' className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value)} className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'>
                            <option value=''>All</option>
                            <option value='Scheduled'>Scheduled</option>
                            <option value='Assigned'>Assigned</option>
                            <option value='In Progress'>In Progress</option>
                            <option value='Started'>Started</option>
                            <option value='Completed'>Completed</option>
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>From</label>
                        <div className='relative'>
                            <DatePicker selected={fromDate} onChange={setFromDate} isClearable className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10' />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>To</label>
                        <div className='relative'>
                            <DatePicker selected={toDate} onChange={setToDate} isClearable className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10' />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                </div>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between items-center mb-4'>
                    <h2 className='text-xl font-medium text-black'>My Duty List</h2>
                    <button type='button' onClick={() => setExportModal(true)} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md flex items-center gap-x-2'>
                        <Download size={16} /> Export
                    </button>
                </div>
                {loading ? (
                    <p className='text-sm text-slate-500 py-8 text-center'>Loading duties…</p>
                ) : error ? (
                    <FeedbackState kind='error' title='Could not load duties' description={error} />
                ) : (
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm'>
                            <thead className='text-xs bg-[#EDEEF5]'>
                                <tr>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Duty ID</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Route</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Vehicle</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Shift</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Status</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((duty) => (
                                    <tr key={duty.id} className='border-b border-[#f2f4f7]'>
                                        <td className='px-2 py-4 font-mono text-indigo-600'>{duty.id}</td>
                                        <td className='px-2 py-4'>{duty.routeName || '—'}</td>
                                        <td className='px-2 py-4'>{duty.vehicleNumber || '—'}</td>
                                        <td className='px-2 py-4'>{duty.shift || '—'}</td>
                                        <td className='px-2 py-4'>
                                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${statusBadgeColor[duty.status] || 'bg-slate-100 text-slate-700'}`}>
                                                {duty.status}
                                            </span>
                                        </td>
                                        <td className='px-2 py-4'>
                                            <select
                                                value={duty.status}
                                                disabled={savingId === duty.id}
                                                onChange={(e) => updateStatus(duty, e.target.value)}
                                                className='text-xs border border-slate-200 rounded-md px-2 py-1'
                                            >
                                                <option value='Assigned'>Assigned</option>
                                                <option value='Scheduled'>Scheduled</option>
                                                <option value='In Progress'>In Progress</option>
                                                <option value='Started'>Started</option>
                                                <option value='Completed'>Completed</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className='text-center py-8 text-slate-400 text-sm'>
                                            No duties assigned to this driver on the server.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className='flex justify-between items-center px-4'>
                <p className='text-sm font-medium text-[#515DEF]'>Showing {filtered.length} of {duties.length} entries</p>
                <div className='flex gap-x-2'>
                    <button type='button' className='size-8 flex justify-center items-center border border-[#E2E8F0] rounded-full'><ChevronLeft size={16} /></button>
                    <button type='button' className='size-8 flex justify-center items-center bg-[#515DEF] text-white rounded-full'>1</button>
                    <button type='button' className='size-8 flex justify-center items-center border border-[#E2E8F0] rounded-full'><ChevronRight size={16} /></button>
                </div>
            </div>
            <ExportModal exportModal={exportModal} setExportModal={setExportModal} />
        </section>
    )
}

export default MyDuty
