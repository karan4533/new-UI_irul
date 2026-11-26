import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronRight, Download, EllipsisIcon, Plus } from 'lucide-react'
import Dropdown from '../../../Common/CommonComponents/Dropdown'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import IntegrationNotice from '../../../Common/ui/IntegrationNotice'
import { useActiveStudent } from '../../../context/ActiveStudentContext'
import {
    displayTcStatus,
    getTcRequestsByStudentId,
    tcStatusBadgeClass,
} from '../../../Common/TcRequest/tcRequestData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTcRequests } from '../../../services/api/tcApiService'

const matchesActiveStudent = (request, activeStudent, activeStudentId) => {
    if (!request) return false
    if (!activeStudentId && !activeStudent) return true
    const ids = [
        activeStudentId,
        activeStudent?.id,
        activeStudent?.admissionNumber,
        activeStudent?.admissionNo,
    ].filter(Boolean).map(String)
    const candidates = [
        request.studentId,
        request.admissionNumber,
        request.id,
    ].filter(Boolean).map(String)
    return candidates.some((value) => ids.includes(value))
}

const TcRequestList = () => {
    const live = isLiveApiEnabled()
    const location = useLocation()
    const { activeStudentId, activeStudent, routePrefix } = useActiveStudent()
    const [requests, setRequests] = useState([])
    const [exportModal, setExportModal] = useState(false)
    const [listLoading, setListLoading] = useState(Boolean(live))
    const [listSource, setListSource] = useState(live ? 'backend' : 'local')
    const [listError, setListError] = useState('')

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
        const rows = Array.isArray(res.data) ? res.data : []
        const filtered = rows.filter((row) => matchesActiveStudent(row, activeStudent, activeStudentId))
        setRequests(filtered)
        setListSource('backend')
    }, [activeStudent, activeStudentId])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setRequests(getTcRequestsByStudentId(activeStudentId))
            setListSource('local')
            setListLoading(false)
            setListError('')
            return
        }
        loadLive()
    }, [activeStudentId, loadLive, location.key])

    const approvedCount = useMemo(
        () => requests.filter((request) => request.status === 'Approved').length,
        [requests],
    )

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4 mb-6'>
                <h1 className='text-2xl font-semibold text-black'>TC Request</h1>
                <p className='text-sm text-[#667085] mt-1'>
                    Request a Transfer Certificate from Front Office. After Super Admin approval, your TC will appear here.
                </p>
                {approvedCount > 0 ? (
                    <p className='text-sm text-[#4CAF50] font-medium mt-2'>
                        {approvedCount} approved TC{approvedCount > 1 ? 's' : ''} available for download.
                    </p>
                ) : null}
            </div>

            {listSource === 'backend' ? (
                <div className='mb-4'>
                    <IntegrationNotice
                        state='connected'
                        title='Live TC requests'
                        description='Loaded from GET /api/v1/tc-requests, filtered to the active student when needed.'
                    />
                </div>
            ) : listSource === 'error' ? (
                <div className='mb-4'>
                    <IntegrationNotice
                        state='failed'
                        title='TC API unavailable'
                        description={listError || 'Could not load transfer certificate requests.'}
                    />
                </div>
            ) : (
                <div className='mb-4'>
                    <IntegrationNotice
                        state='mock'
                        title='Browser TC requests'
                        description='Requests are stored in this browser only.'
                    />
                </div>
            )}

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between items-center sm:flex-row flex-col gap-y-3 mb-4'>
                    <h2 className='text-xl font-medium text-black'>My TC Requests</h2>
                    <div className='flex gap-x-2 flex-wrap'>
                        <NavLink
                            to={`${routePrefix}/tc-request/add`}
                            className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 flex items-center gap-x-2'
                        >
                            <Plus size={16} />
                            Request TC
                        </NavLink>
                        <button
                            type='button'
                            onClick={() => setExportModal(true)}
                            className='bg-white text-[#515DEF] text-sm px-4 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white transition-all duration-200 flex items-center gap-x-2'
                        >
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                </div>

                <div className='relative overflow-x-auto'>
                    <table className='w-full text-sm text-left'>
                        <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                            <tr>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Request ID</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Transfer To</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Requested On</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Status</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>TC Number</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {listLoading ? (
                                <tr>
                                    <td colSpan={6} className='px-2 py-8 text-center text-[#667085]'>
                                        Loading TC requests…
                                    </td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className='px-2 py-8 text-center text-[#667085]'>
                                        No TC requests yet. Click &quot;Request TC&quot; to submit a new request to PRM.
                                    </td>
                                </tr>
                            ) : (
                                requests.map((request) => (
                                    <tr key={request.id} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7]'>
                                        <td className='px-2 py-4 font-medium text-[#1E1E1E] rounded-s-lg'>{request.requestId}</td>
                                        <td className='px-2 py-4'>{request.transferTo}</td>
                                        <td className='px-2 py-4'>{request.requestedOn}</td>
                                        <td className='px-2 py-4'>
                                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${tcStatusBadgeClass(request)}`}>
                                                {displayTcStatus(request)}
                                            </span>
                                        </td>
                                        <td className='px-2 py-4'>{request.tcNumber || '—'}</td>
                                        <td className='px-2 py-4 text-center rounded-e-lg'>
                                            <Dropdown buttonContent={<EllipsisIcon size={16} className='text-black' />}>
                                                <NavLink
                                                    to={`${routePrefix}/tc-request/view/${request.id}`}
                                                    className='block w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'
                                                >
                                                    View
                                                </NavLink>
                                            </Dropdown>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {requests.length > 0 ? (
                <div className='flex justify-between items-center px-4 mt-4'>
                    <p className='text-sm font-medium text-[#515DEF]'>
                        Showing 1 to {requests.length} of {requests.length} entries
                    </p>
                    <div className='flex justify-center gap-x-2 flex-wrap'>
                        <button type='button' className='size-8 flex justify-center items-center p-2 bg-[#515DEF] text-white border border-[#515DEF] rounded-full cursor-pointer'>1</button>
                        <button type='button' className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer'><ChevronRight size={16} /></button>
                    </div>
                </div>
            ) : null}

            <ExportModal exportModal={exportModal} setExportModal={setExportModal} />
        </section>
    )
}

export default TcRequestList
