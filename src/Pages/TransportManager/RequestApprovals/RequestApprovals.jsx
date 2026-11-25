import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    Download,
    Plus,
    Eye,
    CheckCircle,
    XCircle,
    Filter,
    RotateCcw,
} from 'lucide-react'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import {
    getMaintenanceRequests,
    getFuelRequests,
    updateRequestStatus,
    REQUEST_STATUSES,
    ISSUE_TYPES,
    statusBadgeColor,
} from './requestApprovalsData'
import { IntegrationNotice, RejectRequestModal } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    listTransportDriverFuel,
    listTransportDriverMaintenance,
    upsertTransportDriverFuel,
    upsertTransportDriverMaintenance,
} from '../../../services/api/transportApiService'

const mapMaintRow = (row = {}) => ({
    id: row.id,
    requestId: row.maintenanceRequestId || row.id,
    type: 'Maintenance',
    vehicleNumber: row.vehicleNumber || '',
    reportedBy: row.reportedBy || row.driverName || 'Driver',
    driverName: row.driverName || row.reportedBy || 'Driver',
    requestDate: row.requestDate || '',
    issueType: row.issueType || '',
    description: row.description || '',
    priority: row.priority || 'Medium',
    status: row.approvalStatus || row.status || 'Pending',
    estimatedCost: Number(row.estimatedCost) || 0,
    workshop: row.workshop || '',
    source: row.source || 'backend',
})

const mapFuelRow = (row = {}) => ({
    id: row.id,
    requestId: row.fuelRequestId || row.id,
    type: 'Fuel',
    vehicleNumber: row.vehicleNumber || '',
    driverName: row.driverName || 'Driver',
    requestedDate: row.requestDate || '',
    requestDate: row.requestDate || '',
    fuelType: row.fuelType || '',
    quantity: row.quantityLitres || '',
    quantityLitres: row.quantityLitres || '',
    estimatedCost: Number(row.estimatedCost) || 0,
    status: row.approvalStatus || row.status || 'Pending',
    remarks: row.remarks || '',
    source: row.source || 'backend',
})

const TABS = [
    { id: 1, label: 'Maintenance Request' },
    { id: 2, label: 'Fuel Request' },
]

const RequestApprovals = () => {
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [maintenanceList, setMaintenanceList] = useState([])
    const [fuelList, setFuelList] = useState([])
    const [liveError, setLiveError] = useState('')
    const [loading, setLoading] = useState(Boolean(live))

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [issueTypeFilter, setIssueTypeFilter] = useState('')
    const [fromDate, setFromDate] = useState(null)
    const [toDate, setToDate] = useState(null)
    const [activeTab, setActiveTab] = useState(1)
    const [exportModal, setExportModal] = useState(false)
    const [entriesPerPage, setEntriesPerPage] = useState(10)
    const [currentPage, setCurrentPage] = useState(1)

    // Rejection state
    const [rejectTarget, setRejectTarget] = useState(null)
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [toastMessage, setToastMessage] = useState('')

    const loadData = async () => {
        if (!isLiveApiEnabled()) {
            setMaintenanceList(getMaintenanceRequests())
            setFuelList(getFuelRequests())
            setLoading(false)
            setLiveError('')
            return
        }
        setLoading(true)
        setLiveError('')
        const [maint, fuel] = await Promise.all([
            listTransportDriverMaintenance(),
            listTransportDriverFuel(),
        ])
        setLoading(false)
        if (!maint.success || !fuel.success) {
            setLiveError(
                [maint.error, fuel.error].find((item) => typeof item === 'string')
                || 'Failed to load driver maintenance/fuel requests.',
            )
            setMaintenanceList([])
            setFuelList([])
            return
        }
        setMaintenanceList((maint.data || []).map(mapMaintRow))
        setFuelList((fuel.data || []).map(mapFuelRow))
    }

    useEffect(() => {
        loadData()
        if (isLiveApiEnabled()) return undefined
        const handleStorage = (e) => {
            if (
                e.key === 'tm_maintenance_requests' ||
                e.key === 'tm_fuel_requests' ||
                e.type === 'tm_requests_updated'
            ) {
                loadData()
            }
        }
        window.addEventListener('storage', handleStorage)
        window.addEventListener('tm_requests_updated', handleStorage)
        return () => {
            window.removeEventListener('storage', handleStorage)
            window.removeEventListener('tm_requests_updated', handleStorage)
        }
    }, [])

    const handleClearFilters = () => {
        setSearchQuery('')
        setStatusFilter('')
        setIssueTypeFilter('')
        setFromDate(null)
        setToDate(null)
        setCurrentPage(1)
    }

    const parseDateStr = (dateStr) => {
        if (!dateStr) return null
        const parts = dateStr.split(/[-/]/)
        if (parts.length === 3) {
            // Assume dd-mm-yyyy or yyyy-mm-dd
            if (parts[0].length === 4) {
                return new Date(parts[0], parts[1] - 1, parts[2])
            }
            return new Date(parts[2], parts[1] - 1, parts[0])
        }
        const d = new Date(dateStr)
        return isNaN(d.getTime()) ? null : d
    }

    // Filtered data calculation
    const filteredMaintenance = useMemo(() => {
        return maintenanceList.filter((item) => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase()
                const match =
                    item.requestId?.toLowerCase().includes(q) ||
                    item.vehicleNumber?.toLowerCase().includes(q) ||
                    item.reportedBy?.toLowerCase().includes(q) ||
                    item.issueType?.toLowerCase().includes(q) ||
                    item.description?.toLowerCase().includes(q)
                if (!match) return false
            }
            if (statusFilter && item.status !== statusFilter) return false
            if (issueTypeFilter && item.issueType !== issueTypeFilter) return false
            if (fromDate) {
                const itemD = parseDateStr(item.requestDate)
                if (itemD && itemD < fromDate) return false
            }
            if (toDate) {
                const itemD = parseDateStr(item.requestDate)
                if (itemD && itemD > toDate) return false
            }
            return true
        })
    }, [maintenanceList, searchQuery, statusFilter, issueTypeFilter, fromDate, toDate])

    const filteredFuel = useMemo(() => {
        return fuelList.filter((item) => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase()
                const match =
                    item.requestId?.toLowerCase().includes(q) ||
                    item.vehicleNumber?.toLowerCase().includes(q) ||
                    item.driverName?.toLowerCase().includes(q) ||
                    item.driverId?.toLowerCase().includes(q) ||
                    item.routeName?.toLowerCase().includes(q)
                if (!match) return false
            }
            if (statusFilter && item.status !== statusFilter) return false
            if (fromDate) {
                const itemD = parseDateStr(item.requestedDate)
                if (itemD && itemD < fromDate) return false
            }
            if (toDate) {
                const itemD = parseDateStr(item.requestedDate)
                if (itemD && itemD > toDate) return false
            }
            return true
        })
    }, [fuelList, searchQuery, statusFilter, fromDate, toDate])

    const currentList = activeTab === 1 ? filteredMaintenance : filteredFuel

    const totalPages = Math.ceil(currentList.length / entriesPerPage) || 1
    const paginatedList = useMemo(() => {
        const start = (currentPage - 1) * entriesPerPage
        return currentList.slice(start, start + entriesPerPage)
    }, [currentList, currentPage, entriesPerPage])

    const handleQuickApprove = async (item) => {
        if (live) {
            const isFuel = String(item.type || '').toLowerCase() === 'fuel'
            const payload = {
                ...item,
                approvalStatus: 'Approved',
                status: 'Approved',
                approverRemarks: 'Quick approved via portal',
            }
            const res = isFuel
                ? await upsertTransportDriverFuel(payload)
                : await upsertTransportDriverMaintenance(payload)
            if (!res.success) {
                setToastMessage(typeof res.error === 'string' ? res.error : 'Approve failed on server.')
                setTimeout(() => setToastMessage(''), 3500)
                return
            }
            await loadData()
            setToastMessage(`Request ${item.requestId} approved on the server.`)
            setTimeout(() => setToastMessage(''), 3500)
            return
        }
        updateRequestStatus(item.id, 'Approved', 'Quick approved via portal', 'Transport Manager')
        loadData()
        setToastMessage(`Request ${item.requestId} approved successfully.`)
        setTimeout(() => setToastMessage(''), 3500)
    }

    const openRejectModal = (item) => {
        setRejectTarget(item)
        setShowRejectModal(true)
    }

    const handleConfirmReject = async ({ reason }) => {
        if (!rejectTarget) return
        if (live) {
            const isFuel = String(rejectTarget.type || '').toLowerCase() === 'fuel'
            const payload = {
                ...rejectTarget,
                approvalStatus: 'Rejected',
                status: 'Rejected',
                rejectionReason: reason,
                remarks: reason,
            }
            const res = isFuel
                ? await upsertTransportDriverFuel(payload)
                : await upsertTransportDriverMaintenance(payload)
            if (!res.success) {
                setToastMessage(typeof res.error === 'string' ? res.error : 'Reject failed on server.')
                setTimeout(() => setToastMessage(''), 3500)
                return
            }
            await loadData()
            setShowRejectModal(false)
            setRejectTarget(null)
            setToastMessage(`Request ${rejectTarget.requestId} rejected on the server.`)
            setTimeout(() => setToastMessage(''), 3500)
            return
        }
        updateRequestStatus(rejectTarget.id, 'Rejected', reason, 'Transport Manager')
        loadData()
        setShowRejectModal(false)
        setRejectTarget(null)
        setToastMessage(`Request ${rejectTarget.requestId} rejected with documented reason.`)
        setTimeout(() => setToastMessage(''), 3500)
    }

    return (
        <section className='space-y-6 pb-12'>
            {live && !liveError && !loading ? (
                <IntegrationNotice
                    state='connected'
                    title='Request approvals are live'
                    description='Maintenance/fuel queues hydrate from GET /api/v1/ops/transport-driver-maintenance and transport-driver-fuel. Approve/reject persist via PUT. GPS remains DEMO.'
                />
            ) : null}
            {!live ? (
                <IntegrationNotice
                    state='mock'
                    title='Request approvals browser mock'
                    description='Enable live API to decide driver fuel/maintenance requests on FastAPI ops.'
                />
            ) : null}
            {liveError ? (
                <IntegrationNotice state='failed' title='Approvals API failed' description={liveError} />
            ) : null}
            {/* Filter Section */}
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                    <button
                        type='button'
                        onClick={handleClearFilters}
                        className='inline-flex items-center gap-2 bg-[#515DEF] text-white uppercase text-xs font-semibold px-4 py-2 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer shadow-sm'
                    >
                        <RotateCcw className='w-3.5 h-3.5' />
                        Clear Filters
                    </button>
                    <div className='text-xs font-medium text-gray-500'>
                        Total Records: {currentList.length} matching criteria
                    </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:mt-6 mt-3'>
                    <div className='flex flex-col gap-y-1.5'>
                        <label htmlFor='search' className='text-xs font-semibold text-gray-600'>
                            Search
                        </label>
                        <input
                            type='text'
                            id='search'
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setCurrentPage(1)
                            }}
                            placeholder='ID, vehicle, driver...'
                            className='text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#515DEF]'
                        />
                    </div>

                    <div className='flex flex-col gap-y-1.5'>
                        <label htmlFor='status-filter' className='text-xs font-semibold text-gray-600'>
                            Status
                        </label>
                        <select
                            id='status-filter'
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value)
                                setCurrentPage(1)
                            }}
                            className='text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#515DEF]'
                        >
                            <option value=''>All Statuses</option>
                            {REQUEST_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                    </div>

                    {activeTab === 1 && (
                        <div className='flex flex-col gap-y-1.5'>
                            <label htmlFor='issue-type-filter' className='text-xs font-semibold text-gray-600'>
                                Issue Type
                            </label>
                            <select
                                id='issue-type-filter'
                                value={issueTypeFilter}
                                onChange={(e) => {
                                    setIssueTypeFilter(e.target.value)
                                    setCurrentPage(1)
                                }}
                                className='text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#515DEF]'
                            >
                                <option value=''>All Issue Types</option>
                                {ISSUE_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className='flex flex-col gap-y-1.5'>
                        <label className='text-xs font-semibold text-gray-600'>From Date</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={fromDate}
                                onChange={(date) => {
                                    setFromDate(date)
                                    setCurrentPage(1)
                                }}
                                isClearable
                                placeholderText='Start Date'
                                showMonthYearDropdown
                                scrollableMonthYearDropdown
                                className='w-full text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-[#515DEF]'
                            />
                            <Calendar
                                size={15}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none'
                            />
                        </div>
                    </div>

                    <div className='flex flex-col gap-y-1.5'>
                        <label className='text-xs font-semibold text-gray-600'>To Date</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={toDate}
                                onChange={(date) => {
                                    setToDate(date)
                                    setCurrentPage(1)
                                }}
                                isClearable
                                placeholderText='End Date'
                                showMonthYearDropdown
                                scrollableMonthYearDropdown
                                className='w-full text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-[#515DEF]'
                            />
                            <Calendar
                                size={15}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none'
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification Toast */}
            {toastMessage && (
                <div className='p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-center justify-between'>
                    <span>{toastMessage}</span>
                    <button
                        type='button'
                        onClick={() => setToastMessage('')}
                        className='text-emerald-700 hover:text-emerald-900 font-bold ml-4'
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Content Table Card */}
            <div className='bg-white rounded-2xl shadow-md p-4 mt-6'>
                <div className='flex justify-between items-center sm:flex-row flex-col gap-3 mb-4'>
                    <div>
                        <h2 className='text-xl font-bold text-gray-900'>Request & Approvals</h2>
                        <p className='text-xs text-gray-500 mt-0.5'>
                            Manage transport maintenance, repairs, fuel requests, and approvals.
                        </p>
                    </div>
                    <div className='flex items-center gap-2'>
                        <Link
                            to='/transport-manager/request-approvals/add-request'
                            className='inline-flex items-center gap-1.5 bg-[#515DEF] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-opacity-95 transition-all shadow-sm'
                        >
                            <Plus className='w-4 h-4' />
                            Create Request
                        </Link>
                        <button
                            type='button'
                            onClick={() => setExportModal(true)}
                            className='inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-gray-200 transition-all cursor-pointer'
                        >
                            <Download size={15} />
                            Export
                        </button>
                    </div>
                </div>

                <div className='flex gap-x-2 items-center my-3'>
                    <select
                        value={entriesPerPage}
                        onChange={(e) => {
                            setEntriesPerPage(Number(e.target.value))
                            setCurrentPage(1)
                        }}
                        className='px-2.5 py-1 text-sm bg-white text-[#515DEF] border border-[#515DEF] rounded-md font-medium'
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                    </select>
                    <span className='text-xs font-medium text-gray-600'>Entries Per Page</span>
                </div>

                {/* Tab Navigation */}
                <div className='flex gap-6 border-b border-gray-200 overflow-x-auto no-scrollbar my-4'>
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type='button'
                            onClick={() => {
                                setActiveTab(tab.id)
                                setCurrentPage(1)
                            }}
                            className={`whitespace-nowrap px-2 pb-2 text-sm md:text-base font-semibold cursor-pointer transition-all duration-200 ${
                                activeTab === tab.id
                                    ? 'text-[#515DEF] border-b-2 border-[#515DEF]'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab.label} (
                            {tab.id === 1 ? filteredMaintenance.length : filteredFuel.length})
                        </button>
                    ))}
                </div>

                {/* Tab 1: Maintenance Table */}
                {activeTab === 1 && (
                    <div className='relative overflow-x-auto rounded-lg border border-gray-100'>
                        <table className='w-full text-sm text-left'>
                            <thead className='text-xs bg-[#EDEEF5] text-[#0C1E5B] uppercase font-semibold'>
                                <tr>
                                    <th className='px-3 py-3.5'>Request ID</th>
                                    <th className='px-3 py-3.5'>Vehicle</th>
                                    <th className='px-3 py-3.5'>Reported By</th>
                                    <th className='px-3 py-3.5'>Date</th>
                                    <th className='px-3 py-3.5'>Issue Type</th>
                                    <th className='px-3 py-3.5'>Description</th>
                                    <th className='px-3 py-3.5'>Priority</th>
                                    <th className='px-3 py-3.5'>Status</th>
                                    <th className='px-3 py-3.5 text-center'>Actions</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-gray-100'>
                                {paginatedList.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className='text-center py-8 text-gray-500 text-sm'>
                                            No maintenance requests found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedList.map((request) => (
                                        <tr
                                            key={request.id}
                                            className='text-gray-700 hover:bg-gray-50 transition-colors'
                                        >
                                            <td className='px-3 py-3.5 font-semibold text-gray-900 whitespace-nowrap'>
                                                {request.requestId || request.id}
                                            </td>
                                            <td className='px-3 py-3.5 font-medium text-gray-900 whitespace-nowrap'>
                                                {request.vehicleNumber}
                                            </td>
                                            <td className='px-3 py-3.5 whitespace-nowrap'>
                                                {request.reportedBy}
                                            </td>
                                            <td className='px-3 py-3.5 whitespace-nowrap text-gray-500'>
                                                {request.requestDate}
                                            </td>
                                            <td className='px-3 py-3.5 whitespace-nowrap font-medium text-gray-800'>
                                                {request.issueType}
                                            </td>
                                            <td className='px-3 py-3.5 max-w-xs truncate text-gray-600' title={request.description}>
                                                {request.description}
                                            </td>
                                            <td className='px-3 py-3.5 whitespace-nowrap'>
                                                <span
                                                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                        request.priority === 'High'
                                                            ? 'bg-red-100 text-red-700'
                                                            : request.priority === 'Medium'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-emerald-100 text-emerald-700'
                                                    }`}
                                                >
                                                    {request.priority}
                                                </span>
                                            </td>
                                            <td className='px-3 py-3.5 whitespace-nowrap'>
                                                <span
                                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                        statusBadgeColor[request.status] ||
                                                        'bg-gray-100 text-gray-700'
                                                    }`}
                                                >
                                                    {request.status}
                                                </span>
                                            </td>
                                            <td className='px-3 py-3.5 text-center whitespace-nowrap'>
                                                <div className='inline-flex items-center gap-1.5'>
                                                    <Link
                                                        to={`/transport-manager/request-approvals/view-request/${request.id}`}
                                                        className='p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors'
                                                        title='View Details'
                                                    >
                                                        <Eye className='w-4 h-4' />
                                                    </Link>
                                                    {request.status === 'Pending' && (
                                                        <>
                                                            <button
                                                                type='button'
                                                                onClick={() => handleQuickApprove(request)}
                                                                className='p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors'
                                                                title='Approve Request'
                                                            >
                                                                <CheckCircle className='w-4 h-4' />
                                                            </button>
                                                            <button
                                                                type='button'
                                                                onClick={() => openRejectModal(request)}
                                                                className='p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors'
                                                                title='Reject Request'
                                                            >
                                                                <XCircle className='w-4 h-4' />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab 2: Fuel Table */}
                {activeTab === 2 && (
                    <div className='relative overflow-x-auto rounded-lg border border-gray-100'>
                        <table className='w-full text-sm text-left'>
                            <thead className='text-xs bg-[#EDEEF5] text-[#0C1E5B] uppercase font-semibold'>
                                <tr>
                                    <th className='px-3 py-3.5'>Request ID</th>
                                    <th className='px-3 py-3.5'>Driver</th>
                                    <th className='px-3 py-3.5'>Driver ID</th>
                                    <th className='px-3 py-3.5'>Vehicle</th>
                                    <th className='px-3 py-3.5'>Route</th>
                                    <th className='px-3 py-3.5'>Odometer</th>
                                    <th className='px-3 py-3.5'>Qty</th>
                                    <th className='px-3 py-3.5'>Date</th>
                                    <th className='px-3 py-3.5'>Status</th>
                                    <th className='px-3 py-3.5 text-center'>Actions</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-gray-100'>
                                {paginatedList.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className='text-center py-8 text-gray-500 text-sm'>
                                            No fuel requests found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedList.map((request) => (
                                        <tr
                                            key={request.id}
                                            className='text-gray-700 hover:bg-gray-50 transition-colors'
                                        >
                                            <td className='px-3 py-3.5 font-semibold text-gray-900 whitespace-nowrap'>
                                                {request.requestId || request.id}
                                            </td>
                                            <td className='px-3 py-3.5 font-medium text-gray-900 whitespace-nowrap'>
                                                {request.driverName}
                                            </td>
                                            <td className='px-3 py-3.5 whitespace-nowrap text-gray-500'>
                                                {request.driverId}
                                            </td>
                                            <td className='px-3 py-3.5 font-medium text-gray-900 whitespace-nowrap'>
                                                {request.vehicleNumber}
                                            </td>
                                            <td className='px-3 py-3.5 whitespace-nowrap text-gray-700'>
                                                {request.routeName}
                                            </td>
                                            <td className='px-3 py-3.5 whitespace-nowrap text-gray-600'>
                                                {request.currentOdometerReading}
                                            </td>
                                            <td className='px-3 py-3.5 font-semibold text-amber-700 whitespace-nowrap'>
                                                {request.requestedQuantity}
                                            </td>
                                            <td className='px-3 py-3.5 whitespace-nowrap text-gray-500'>
                                                {request.requestedDate}
                                            </td>
                                            <td className='px-3 py-3.5 whitespace-nowrap'>
                                                <span
                                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                        statusBadgeColor[request.status] ||
                                                        'bg-gray-100 text-gray-700'
                                                    }`}
                                                >
                                                    {request.status}
                                                </span>
                                            </td>
                                            <td className='px-3 py-3.5 text-center whitespace-nowrap'>
                                                <div className='inline-flex items-center gap-1.5'>
                                                    <Link
                                                        to={`/transport-manager/request-approvals/view-request/${request.id}`}
                                                        className='p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors'
                                                        title='View Details'
                                                    >
                                                        <Eye className='w-4 h-4' />
                                                    </Link>
                                                    {request.status === 'Pending' && (
                                                        <>
                                                            <button
                                                                type='button'
                                                                onClick={() => handleQuickApprove(request)}
                                                                className='p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors'
                                                                title='Approve Request'
                                                            >
                                                                <CheckCircle className='w-4 h-4' />
                                                            </button>
                                                            <button
                                                                type='button'
                                                                onClick={() => openRejectModal(request)}
                                                                className='p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors'
                                                                title='Reject Request'
                                                            >
                                                                <XCircle className='w-4 h-4' />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            <div className='flex justify-between items-center px-4 mt-4'>
                <p className='text-sm font-medium text-[#515DEF]'>
                    Showing {paginatedList.length === 0 ? 0 : (currentPage - 1) * entriesPerPage + 1} to{' '}
                    {Math.min(currentPage * entriesPerPage, currentList.length)} of {currentList.length} entries
                </p>
                <div className='flex justify-center gap-x-2 flex-wrap'>
                    <button
                        type='button'
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className='size-8 flex justify-center items-center p-2 bg-[#515DEF] text-white border border-[#515DEF] rounded-full text-xs font-semibold'>
                        {currentPage}
                    </span>
                    <button
                        type='button'
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Rejection Modal with Mandatory Description */}
            {rejectTarget && (
                <RejectRequestModal
                    isOpen={showRejectModal}
                    onClose={() => {
                        setShowRejectModal(false)
                        setRejectTarget(null)
                    }}
                    onConfirm={handleConfirmReject}
                    title={`Reject Request ${rejectTarget.requestId || rejectTarget.id}`}
                    itemDescription={`${rejectTarget.type || 'Transport'} Request for ${
                        rejectTarget.vehicleNumber
                    }`}
                    confirmLabel='Reject Request'
                />
            )}

            <ExportModal exportModal={exportModal} setExportModal={setExportModal} />
        </section>
    )
}

export default RequestApprovals
