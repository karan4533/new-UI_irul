import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import no_profile from '../../../assets/images/no-profile.png'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listHostelGatePassesLive } from '../../../services/api/gateApiService'

const bagdeColor = {
    Returned: 'bg-[#4CAF5033] text-[#4CAF50]',
    'Checked Out': 'bg-[#FF980033] text-[#FF9800]',
    Approved: 'bg-[#4CAF5033] text-[#4CAF50]',
    Pending: 'bg-[#FF980033] text-[#FF9800]',
}

const statusColor = {
    Approved: 'text-[#4CAF50]',
    Pending: 'text-[#FF0000]',
    'On Processing': 'text-[#FF9800]',
}

const HosteGatePass = () => {
    const live = isLiveApiEnabled()
    const [fromDate, setFromDate] = useState(null)
    const [toDate, setToDate] = useState(null)
    const [exportModal, setExportModal] = useState(false)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        if (!live) {
            setRows([])
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const res = await listHostelGatePassesLive()
        if (!res.success) {
            setRows([])
            setError(res.error || 'Failed to load hostel gate passes.')
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
        return rows.filter((item) => {
            if (search.trim()) {
                const q = search.toLowerCase()
                const hay = `${item.gatePassId} ${item.studentName} ${item.classSection} ${item.leaveType}`.toLowerCase()
                if (!hay.includes(q)) return false
            }
            if (statusFilter && String(item.finalStatus || item.principalApproval) !== statusFilter) return false
            return true
        })
    }, [rows, search, statusFilter])

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Hostel gate passes use GET /api/v1/front-office/hostel-gate-passes (read-only for Gate Keeper).'
            />
        )
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <IntegrationNotice
                    state='connected'
                    className='mb-4'
                    title='Gate Keeper verification write is blocked'
                    description='Backend allows Gate Keeper to read hostel gate passes only. Create/update remains PRM/admin (403 for gatekeeper POST/PUT). Status values below are display-only.'
                />
                <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                    <button
                        type='button'
                        onClick={() => {
                            setSearch('')
                            setStatusFilter('')
                            setFromDate(null)
                            setToDate(null)
                        }}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-2 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'
                    >
                        Clear Filters
                    </button>
                    <button
                        type='button'
                        onClick={load}
                        className='text-sm font-medium text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2'
                    >
                        Refresh
                    </button>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='search' className='text-base font-medium text-[#808080]'>Search</label>
                        <input
                            id='search'
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            type='text'
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='status' className='text-base font-medium text-[#808080]'>Status</label>
                        <select
                            id='status'
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            <option value='Approved'>Approved</option>
                            <option value='Pending'>Pending</option>
                            <option value='Returned'>Returned</option>
                            <option value='Checked Out'>Checked Out</option>
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>From</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={fromDate}
                                onChange={(date) => setFromDate(date)}
                                isClearable
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>To</label>
                        <div className='relative'>
                            <DatePicker
                                selected={toDate}
                                onChange={(date) => setToDate(date)}
                                isClearable
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                </div>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                    <h2 className='text-xl font-medium text-black'>Hostel Gate Pass List</h2>
                    <button
                        type='button'
                        onClick={() => setExportModal(true)}
                        className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                    >
                        <Download size={16} />
                        Export
                    </button>
                </div>
                {loading ? (
                    <p className='text-sm text-slate-500 py-8 text-center'>Loading hostel gate passes…</p>
                ) : error ? (
                    <FeedbackState kind='error' title='Could not load hostel gate passes' description={error} />
                ) : (
                    <div className='relative overflow-x-auto'>
                        <table className='w-full text-sm text-left rtl:text-right'>
                            <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                                <tr>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase text-center rounded-s-lg'>Profile</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Gate Pass ID</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Student Name</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Class</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Hostel</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Leave Type</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Out Date</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Return Date</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Parent Approval</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Principal Approval</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Gate Keeper</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Final Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((row) => (
                                    <tr key={row.id || row.gatePassId} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7]'>
                                        <td className='px-2 py-4 object-cover flex justify-center'>
                                            <img src={no_profile} alt='' className='w-9 h-9' />
                                        </td>
                                        <td className='px-2 py-4 font-mono'>{row.gatePassId || row.id}</td>
                                        <td className='px-2 py-4'>{row.studentName || '—'}</td>
                                        <td className='px-2 py-4'>{row.classSection || '—'}</td>
                                        <td className='px-2 py-4'>{row.hostel || '—'}</td>
                                        <td className='px-2 py-4'>{row.leaveType || '—'}</td>
                                        <td className='px-2 py-4'>{[row.outDate, row.outTime].filter(Boolean).join(' ') || '—'}</td>
                                        <td className='px-2 py-4'>{row.returnDate || '—'}</td>
                                        <td className='px-2 py-4'>
                                            <span className={`font-medium ${statusColor[row.parentApproval] || 'text-slate-500'}`}>
                                                {row.parentApproval || '—'}
                                            </span>
                                        </td>
                                        <td className='px-2 py-4'>
                                            <span className={`font-medium ${statusColor[row.principalApproval] || 'text-slate-500'}`}>
                                                {row.principalApproval || '—'}
                                            </span>
                                        </td>
                                        <td className='px-2 py-4 text-sm'>{row.gateKeeperStatus || 'Pending'}</td>
                                        <td className='px-2 py-4'>
                                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${bagdeColor[row.finalStatus] || 'bg-slate-100 text-slate-600'}`}>
                                                {row.finalStatus || '—'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={12} className='text-center py-8 text-slate-400 text-sm'>
                                            No hostel gate passes on the server yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className='flex justify-between items-center px-4 mt-4'>
                <p className='text-sm font-medium text-[#515DEF]'>Showing {filtered.length} of {rows.length} entries</p>
                <div className='flex justify-center gap-x-2 flex-wrap'>
                    <button type='button' className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] rounded-full'>
                        <ChevronLeft size={16} />
                    </button>
                    <button type='button' className='size-8 flex justify-center items-center p-2 bg-[#515DEF] text-white border border-[#515DEF] rounded-full'>1</button>
                    <button type='button' className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] rounded-full'>
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <ExportModal exportModal={exportModal} setExportModal={setExportModal} />
        </section>
    )
}

export default HosteGatePass
