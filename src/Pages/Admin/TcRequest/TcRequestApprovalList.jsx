import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronRight, Download, EllipsisIcon } from 'lucide-react'
import Dropdown from '../../../Common/CommonComponents/Dropdown'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import { FeedbackState } from '../../../Common/ui'
import {
    TC_STATUSES,
    displayTcStatus,
    getAllTcRequests,
    getPendingSuperAdminCount,
    tcStatusBadgeClass,
} from '../../../Common/TcRequest/tcRequestData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTcRequests } from '../../../services/api/tcApiService'

const TcRequestApprovalList = ({ basePath = '/admin/tc-request-approval' }) => {
    const live = isLiveApiEnabled()
    const location = useLocation()
    const listBase = String(basePath || '/admin/tc-request-approval').replace(/\/$/, '')
    const [requests, setRequests] = useState(() => (live ? [] : []))
    const [statusFilter, setStatusFilter] = useState('')
    const [exportModal, setExportModal] = useState(false)
    const [listLoading, setListLoading] = useState(Boolean(live))
    const [listError, setListError] = useState('')
    const [listSource, setListSource] = useState(live ? 'backend' : 'local')

    const loadLive = useCallback(async () => {
        setListLoading(true)
        setListError('')
        const res = await listTcRequests()
        setListLoading(false)
        if (!res.success) {
            setListSource('error')
            setListError(typeof res.error === 'string' ? res.error : 'Failed to load TC requests.')
            setRequests([])
            return
        }
        setRequests(Array.isArray(res.data) ? res.data : [])
        setListSource('backend')
    }, [])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setRequests(getAllTcRequests())
            setListSource('local')
            setListLoading(false)
            setListError('')
            return
        }
        loadLive()
    }, [loadLive, location.key])

    const pendingCount = useMemo(() => {
        if (live || listSource === 'backend') {
            return requests.filter((request) => request.status === 'Pending Super Admin Approval').length
        }
        return getPendingSuperAdminCount()
    }, [live, listSource, requests])

    const filteredRequests = useMemo(() => {
        if (!statusFilter) return requests
        return requests.filter((request) => request.status === statusFilter)
    }, [requests, statusFilter])

    return (
        <section className='space-y-6'>
            <div>
                <h1 className='text-2xl font-semibold text-black'>TC Request Approval</h1>
                <p className='text-sm text-[#667085] mt-1'>
                    Administrator approval for Transfer Certificate requests forwarded by PRM. Approved TCs are sent to the student portal.
                </p>
            </div>

            {live ? (
                <div className={`rounded-2xl border px-4 py-3 ${listSource === 'error' ? 'border-red-200 bg-red-50/60' : 'border-emerald-200 bg-emerald-50/60'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${listSource === 'error' ? 'text-red-800' : 'text-emerald-800'}`}>
                        {listSource === 'error' ? 'TC API unavailable' : 'Live TC requests · GET /api/v1/tc-requests'}
                    </p>
                    {listLoading ? (
                        <div className='mt-2'><FeedbackState kind='loading' title='Loading TC requests' description='Fetching from the TC API…' /></div>
                    ) : listError ? (
                        <p className='mt-1 text-xs text-red-700'>{listError}</p>
                    ) : (
                        <p className='mt-1 text-xs text-slate-600'>{requests.length} request(s) · {pendingCount} awaiting administrator approval.</p>
                    )}
                </div>
            ) : null}

            {pendingCount > 0 ? (
                <button
                    type='button'
                    onClick={() => setStatusFilter(statusFilter === 'Pending Super Admin Approval' ? '' : 'Pending Super Admin Approval')}
                    className={`text-left w-full sm:w-auto rounded-xl border px-4 py-3 transition-all cursor-pointer ${
                        statusFilter === 'Pending Super Admin Approval'
                            ? 'border-[#515DEF] bg-[#515DEF08] ring-2 ring-[#515DEF]'
                            : 'border-[#E4E7EC] hover:border-[#515DEF] bg-white'
                    }`}
                >
                    <p className='text-sm font-medium text-[#808080]'>Pending administrator approval</p>
                    <p className='text-2xl font-bold text-[#0C1E5B] mt-1'>{pendingCount}</p>
                </button>
            ) : null}

            {!listLoading && listSource !== 'error' ? (
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex flex-wrap items-center justify-between gap-3 mb-4'>
                    <div className='flex items-center gap-2'>
                        <label className='text-sm text-[#808080]'>Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className='text-sm border border-[#D9D9D9] rounded-md px-2 py-1.5 text-[#808080]'
                        >
                            <option value=''>All</option>
                            {TC_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        type='button'
                        onClick={() => setExportModal(true)}
                        className='inline-flex items-center gap-2 bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md'
                    >
                        <Download size={16} /> Export
                    </button>
                </div>

                {filteredRequests.length === 0 ? (
                    <div className='py-12 text-center text-[#667085]'>No TC requests match the current filter.</div>
                ) : (
                    <div className='relative overflow-x-auto'>
                        <table className='w-full text-sm text-left'>
                            <thead className='text-xs bg-[#EDEEF5]'>
                                <tr>
                                    <th className='px-3 py-3 text-[#0C1E5B] font-medium uppercase'>Request ID</th>
                                    <th className='px-3 py-3 text-[#0C1E5B] font-medium uppercase'>Student</th>
                                    <th className='px-3 py-3 text-[#0C1E5B] font-medium uppercase'>Admission No</th>
                                    <th className='px-3 py-3 text-[#0C1E5B] font-medium uppercase'>Status</th>
                                    <th className='px-3 py-3 text-[#0C1E5B] font-medium uppercase'>Requested On</th>
                                    <th className='px-3 py-3 text-[#0C1E5B] font-medium uppercase'>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRequests.map((request) => (
                                    <tr key={request.id} className='border-b border-[#F0F1F5]'>
                                        <td className='px-3 py-3 font-semibold text-[#0C1E5B]'>{request.requestId}</td>
                                        <td className='px-3 py-3'>{request.studentName}</td>
                                        <td className='px-3 py-3'>{request.admissionNumber}</td>
                                        <td className='px-3 py-3'>
                                            <span className={`px-2 py-1 rounded-md text-xs font-semibold ${tcStatusBadgeClass(request)}`}>
                                                {displayTcStatus(request)}
                                            </span>
                                        </td>
                                        <td className='px-3 py-3'>{request.requestedOn}</td>
                                        <td className='px-3 py-3'>
                                            <Dropdown
                                                buttonContent={<span className='inline-flex p-1.5 rounded hover:bg-[#EDEEF5]'><EllipsisIcon size={16} /></span>}
                                            >
                                                <NavLink
                                                    to={`${listBase}/view/${request.id}`}
                                                    className='flex items-center gap-2 p-2 hover:bg-[#515DEF] hover:text-white rounded'
                                                >
                                                    Review <ChevronRight size={14} />
                                                </NavLink>
                                            </Dropdown>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            ) : null}

            <ExportModal exportModal={exportModal} setExportModal={setExportModal} />
        </section>
    )
}

export default TcRequestApprovalList
