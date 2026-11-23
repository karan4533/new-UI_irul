import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Download } from 'lucide-react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import DataTable from '../ui/DataTable'
import DataToolbar from '../ui/DataToolbar'
import FeedbackState from '../ui/FeedbackState'
import PageHeader from '../ui/PageHeader'
import Pagination from '../ui/Pagination'
import StatusBadge from '../ui/StatusBadge'
import { paginateRows, parseTableState, serializeTableState } from '../ui/dataTableState'
import { getReceivedLeaveRequestsForRole, LEAVE_REQUESTS_UPDATED_EVENT, LEAVE_STATUSES, parseLeaveDate } from './leaveRequestData'
import { getLeaveReceivedViewPath, resolveRoleKey } from './leaveRequestConfigs'
import { isLiveApiEnabled } from '../../services/api/tokenStore'
import { listLeaveRequests } from '../../services/api/leaveApiService'

export default function ReceivedLeaveRequestsList({ roleKey: roleKeyProp, description }) {
    const live = isLiveApiEnabled()
    const { role: authRole } = useAuth()
    const roleKey = resolveRoleKey(authRole || roleKeyProp)
    const [urlParams, setUrlParams] = useSearchParams()
    const initialTableState = parseTableState(urlParams)
    const [search, setSearch] = useState(initialTableState.query)
    const [statusFilter, setStatusFilter] = useState(initialTableState.filters.status || '')
    const [fromDate, setFromDate] = useState(initialTableState.filters.fromDate || '')
    const [page, setPage] = useState(initialTableState.page)
    const [pageSize, setPageSize] = useState(initialTableState.pageSize)
    const [refreshKey, setRefreshKey] = useState(0)
    const [requests, setRequests] = useState(() => (live ? [] : getReceivedLeaveRequestsForRole(roleKey)))
    const [listLoading, setListLoading] = useState(Boolean(live))
    const [listError, setListError] = useState('')
    const [listSource, setListSource] = useState(live ? 'backend' : 'local')

    const loadLive = useCallback(async () => {
        setListLoading(true)
        setListError('')
        // Admin/HR/Super Admin may list all campus leave; others see the received approval queue only.
        const box = ['admin', 'superadmin', 'hr'].includes(roleKey) ? 'all' : 'received'
        const res = await listLeaveRequests({ box })
        setListLoading(false)
        if (!res.success) {
            setListSource('error')
            setListError(typeof res.error === 'string' ? res.error : 'Failed to load leave requests.')
            setRequests([])
            return
        }
        setRequests(Array.isArray(res.data) ? res.data : [])
        setListSource('backend')
    }, [roleKey])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setRequests(getReceivedLeaveRequestsForRole(roleKey))
            setListSource('local')
            setListLoading(false)
            setListError('')
            return
        }
        loadLive()
    }, [loadLive, refreshKey, roleKey])

    useEffect(() => {
        if (isLiveApiEnabled()) return undefined
        const refresh = () => setRefreshKey((value) => value + 1)
        window.addEventListener(LEAVE_REQUESTS_UPDATED_EVENT, refresh)
        window.addEventListener('storage', refresh)
        return () => {
            window.removeEventListener(LEAVE_REQUESTS_UPDATED_EVENT, refresh)
            window.removeEventListener('storage', refresh)
        }
    }, [])

    const filteredRequests = useMemo(() => {
        const query = search.trim().toLowerCase()
        const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null
        return requests.filter((request) => {
            if (statusFilter && request.status !== statusFilter) return false
            const requestDate = parseLeaveDate(request.appliedDate)
            if (from && requestDate && requestDate < from) return false
            if (!query) return true
            return [request.leaveRequestId, request.requestedBy, request.role, request.leaveType, request.status]
                .some((value) => String(value || '').toLowerCase().includes(query))
        })
    }, [requests, search, statusFilter, fromDate])
    const pagination = paginateRows(filteredRequests, { page, pageSize })

    useEffect(() => {
        setUrlParams(serializeTableState({
            query: search,
            page: pagination.page,
            pageSize,
            filters: { status: statusFilter, fromDate },
        }), { replace: true })
    }, [fromDate, pageSize, pagination.page, search, setUrlParams, statusFilter])

    const resetFilters = () => {
        setSearch('')
        setStatusFilter('')
        setFromDate('')
        setPage(1)
    }
    const pendingCount = requests.filter((request) => request.status === 'Pending').length

    const columns = [
        { key: 'leaveRequestId', label: 'Request ID', required: true, render: (request) => <span className='font-semibold text-[var(--erp-ink)]'>{request.leaveRequestId}</span> },
        { key: 'requestedBy', label: 'Requester', render: (request) => <span><span className='block font-medium text-[var(--erp-ink)]'>{request.requestedBy}</span><span className='text-xs text-[var(--erp-muted)]'>{request.role}{request.department ? ` · ${request.department}` : ''}</span></span> },
        { key: 'leaveType', label: 'Leave type' },
        { key: 'period', label: 'Period', render: (request) => <span>{request.fromDate} – {request.toDate}<span className='block text-xs text-[var(--erp-muted)]'>{request.totalDays} day{Number(request.totalDays) === 1 ? '' : 's'}</span></span> },
        { key: 'appliedDate', label: 'Applied' },
        { key: 'status', label: 'Decision state', render: (request) => <StatusBadge status={request.status} /> },
    ]

    return (
        <section className='space-y-5'>
            <PageHeader
                title='Leave approvals'
                description={description || 'Review requests assigned to your role and record a clear decision.'}
                context={`${pendingCount} awaiting decision · ${requests.length} total`}
            />

            {listSource === 'error' ? (
                <FeedbackState kind='error' title='Leave API unavailable' description={listError} />
            ) : null}

            {listLoading ? (
                <FeedbackState kind='loading' title='Loading leave requests' description='Fetching received leave requests…' />
            ) : null}

            {!listLoading && listSource !== 'error' ? (
            <div className='overflow-hidden rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white'>
                <DataToolbar
                    query={search}
                    onQueryChange={(value) => { setSearch(value); setPage(1) }}
                    searchPlaceholder='Search request or requester'
                    resultCount={filteredRequests.length}
                    onReset={resetFilters}
                    filters={(
                        <>
                            <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Decision state
                                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                    <option value=''>All statuses</option>
                                    {LEAVE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                                </select>
                            </label>
                            <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Applied from
                                <input type='date' value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] px-3 text-sm' />
                            </label>
                        </>
                    )}
                    actions={<button type='button' disabled title='Export service is not connected' className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] px-4 text-sm font-semibold text-[var(--erp-muted)] opacity-65'><Download aria-hidden='true' size={16} /> Export unavailable</button>}
                />
                <DataTable
                    caption='Leave approvals'
                    rows={pagination.rows}
                    columns={columns}
                    rowKey='id'
                    emptyTitle='No approval requests found'
                    emptyDescription='No requests match the current filters or role scope.'
                    renderActions={(request) => <NavLink to={getLeaveReceivedViewPath(roleKey, request.id)} className='inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--erp-line-strong)] px-3 text-xs font-semibold text-[var(--erp-ink)]'>{request.status === 'Pending' ? 'Decide' : 'Review'} <ArrowUpRight aria-hidden='true' size={14} /></NavLink>}
                />
                <Pagination {...pagination} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} />
            </div>
            ) : null}
        </section>
    )
}
