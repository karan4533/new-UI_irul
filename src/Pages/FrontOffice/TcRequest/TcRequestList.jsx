import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, EllipsisIcon } from 'lucide-react'
import Dropdown from '../../../Common/CommonComponents/Dropdown'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import { FeedbackState } from '../../../Common/ui'
import {
    TC_STATUSES,
    getAllTcRequests,
    statusBadgeColor,
} from '../../../Common/TcRequest/tcRequestData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTcRequests } from '../../../services/api/tcApiService'

const TcRequestList = () => {
    const location = useLocation()
    const live = isLiveApiEnabled()
    const [requests, setRequests] = useState(() => (live ? [] : getAllTcRequests()))
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [exportModal, setExportModal] = useState(false)
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [source, setSource] = useState(live ? 'backend' : 'local')

    const loadLive = useCallback(async () => {
        setLoading(true)
        setError('')
        const res = await listTcRequests()
        setLoading(false)
        if (!res.success) {
            setSource('error')
            setError(typeof res.error === 'string' ? res.error : 'Failed to load TC requests.')
            setRequests([])
            return
        }
        setRequests(Array.isArray(res.data) ? res.data : [])
        setSource('backend')
    }, [])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setRequests(getAllTcRequests())
            setSource('local')
            setLoading(false)
            return
        }
        loadLive()
    }, [loadLive, location.key])

    const pendingCount = useMemo(
        () => requests.filter((row) => row.status === 'Pending PRM Review').length,
        [requests],
    )

    const filteredRequests = useMemo(() => {
        const query = search.trim().toLowerCase()
        return requests.filter((request) => {
            if (statusFilter && request.status !== statusFilter) return false
            if (!query) return true
            return [
                request.requestId,
                request.studentName,
                request.admissionNumber,
                request.classSection,
                request.transferTo,
                request.reason,
            ].some((field) => String(field || '').toLowerCase().includes(query))
        })
    }, [requests, statusFilter, search])

    return (
        <section className='space-y-6'>
            <div>
                <h1 className='text-2xl font-semibold text-black'>TC Requests</h1>
                <p className='text-sm text-[#667085] mt-1'>
                    Review Transfer Certificate requests from students and parents. Forward verified requests to Super Admin for approval.
                </p>
            </div>

            {source === 'backend' ? (
            ) : null}
            {source === 'error' ? (
                <FeedbackState kind='error' title='TC API unavailable' description={error} />
            ) : null}
            {loading ? (
                <FeedbackState kind='loading' title='Loading TC requests' description='Fetching from the TC API…' />
            ) : null}

            {!loading && source !== 'error' ? (
                <>
                    {pendingCount > 0 ? (
                        <button
                            type='button'
                            onClick={() => setStatusFilter(statusFilter === 'Pending PRM Review' ? '' : 'Pending PRM Review')}
                            className={`text-left w-full sm:w-auto rounded-xl border px-4 py-3 transition-all cursor-pointer ${
                                statusFilter === 'Pending PRM Review'
                                    ? 'border-[#515DEF] bg-[#515DEF08] ring-2 ring-[#515DEF]'
                                    : 'border-[#E4E7EC] hover:border-[#515DEF] bg-white'
                            }`}
                        >
                            <p className='text-sm font-medium text-[#808080]'>Pending PRM review</p>
                            <p className='text-2xl font-bold text-[#0C1E5B] mt-1'>{pendingCount}</p>
                        </button>
                    ) : null}

                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-base font-medium text-[#808080]'>Search</label>
                                <input
                                    type='text'
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder='Request ID, student name, admission no...'
                                    className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full focus:outline-none focus:border-[#515DEF]'
                                />
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-base font-medium text-[#808080]'>Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                                >
                                    <option value=''>All</option>
                                    {TC_STATUSES.map((status) => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <div className='flex justify-between items-center mb-4'>
                            <h2 className='text-xl font-medium text-black'>Received TC Requests</h2>
                            <button type='button' onClick={() => setExportModal(true)} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'>
                                <Download size={16} />
                                Export
                            </button>
                        </div>
                        <div className='relative overflow-x-auto'>
                            <table className='w-full text-sm text-left'>
                                <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                                    <tr>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Request ID</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Student</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Class</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Transfer To</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Requested By</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Requested On</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Status</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRequests.length === 0 ? (
                                        <tr><td colSpan={8} className='px-2 py-8 text-center text-[#667085]'>No TC requests found.</td></tr>
                                    ) : filteredRequests.map((request) => (
                                        <tr key={request.requestId || request.id} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7]'>
                                            <td className='px-2 py-4 font-medium text-[#1E1E1E] rounded-s-lg'>{request.requestId}</td>
                                            <td className='px-2 py-4'>{request.studentName}</td>
                                            <td className='px-2 py-4'>{request.classSection}</td>
                                            <td className='px-2 py-4'>{request.transferTo}</td>
                                            <td className='px-2 py-4'>{request.requestedBy}</td>
                                            <td className='px-2 py-4'>{request.requestedOn}</td>
                                            <td className='px-2 py-4'>
                                                <span className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${statusBadgeColor[request.status] || 'bg-slate-100 text-slate-700'}`}>
                                                    {request.status}
                                                </span>
                                            </td>
                                            <td className='px-2 py-4 text-center rounded-e-lg'>
                                                <Dropdown buttonContent={<EllipsisIcon size={16} className='text-black' />}>
                                                    <NavLink to={`/front-office/tc-request/view/${request.requestId || request.id}`} className='block w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'>View</NavLink>
                                                </Dropdown>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className='flex justify-between items-center px-4'>
                        <p className='text-sm font-medium text-[#515DEF]'>Showing 1 to {filteredRequests.length} of {filteredRequests.length} entries</p>
                        <div className='flex justify-center gap-x-2 flex-wrap'>
                            <button type='button' className='size-8 flex justify-center items-center p-2 bg-[#515DEF] text-white border border-[#515DEF] rounded-full cursor-pointer'>1</button>
                            <button type='button' className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer'><ChevronRight size={16} /></button>
                            <button type='button' className='hidden size-8'><ChevronLeft size={16} /></button>
                        </div>
                    </div>

                    <ExportModal exportModal={exportModal} setExportModal={setExportModal} />
                </>
            ) : null}
        </section>
    )
}

export default TcRequestList
