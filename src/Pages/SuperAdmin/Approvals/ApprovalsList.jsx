import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Download, RefreshCw } from 'lucide-react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
    DataTable,
    DataToolbar,
    PageHeader,
    Pagination,
    StatusBadge,
} from '../../../Common/ui'
import { paginateRows, parseTableState, serializeTableState } from '../../../Common/ui/dataTableState'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listApprovalsInbox } from '../../../services/api/approvalsApiService'
import {
    APPROVAL_STATUSES,
    filterApprovalRequests,
    formatAmount,
    getApprovalSummary,
    REQUEST_CATEGORIES,
    ROUTE_BASE,
} from './approvalsData'

const ApprovalsList = () => {
    const live = isLiveApiEnabled()
    const [urlParams, setUrlParams] = useSearchParams()
    const initialTableState = parseTableState(urlParams)
    const [records, setRecords] = useState(() => (live ? [] : getAllApprovalRequests()))
    const [search, setSearch] = useState(initialTableState.query)
    const [category, setCategory] = useState(initialTableState.filters.category || '')
    const [status, setStatus] = useState(initialTableState.filters.status || '')
    const [page, setPage] = useState(initialTableState.page)
    const [pageSize, setPageSize] = useState(urlParams.has('pageSize') ? initialTableState.pageSize : 5)

    const loadLive = useCallback(async () => {
        const res = await listApprovalsInbox()
        if (!res.success) {
            setRecords([])
            return
        }
        setRecords(Array.isArray(res.data) ? res.data : [])
    }, [])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setRecords(getAllApprovalRequests())
            return
        }
        loadLive()
    }, [loadLive])

    const summary = useMemo(() => getApprovalSummary(records), [records])
    const filteredRecords = useMemo(
        () => filterApprovalRequests(records, { search, category, status }),
        [records, search, category, status],
    )
    const pagination = paginateRows(filteredRecords, { page, pageSize })

    useEffect(() => {
        setUrlParams(serializeTableState({
            query: search,
            page: pagination.page,
            pageSize,
            filters: { category, status },
        }), { replace: true })
    }, [category, pageSize, pagination.page, search, setUrlParams, status])

    const columns = [
        { key: 'requestId', label: 'Request', required: true, render: (request) => <span><span className='block font-semibold text-[var(--erp-ink)]'>{request.title}</span><span className='block text-xs text-[var(--erp-muted)]'>{request.requestId}</span></span> },
        { key: 'requestDate', label: 'Received' },
        { key: 'category', label: 'Category', render: (request) => <StatusBadge status='info' label={request.category} /> },
        { key: 'requestedBy', label: 'Requester', render: (request) => <span><span className='block text-[var(--erp-ink)]'>{request.requestedBy}</span><span className='block text-xs text-[var(--erp-muted)]'>{request.department}</span></span> },
        { key: 'amount', label: 'Amount', render: (request) => formatAmount(request.amount) },
        { key: 'priority', label: 'Priority', render: (request) => <StatusBadge status={request.priority === 'High' ? 'overdue' : request.priority === 'Low' ? 'closed' : 'info'} label={request.priority} /> },
        { key: 'status', label: 'Status', render: (request) => <StatusBadge status={request.status} /> },
    ]

    if (!live) {
        return (
            <section className='space-y-5'>
                <PageHeader
                    title='Approval inbox'
                    description='Finance, data, HR, procurement, budget and policy requests routed for final governance review.'
                />
                <FeedbackState
                    kind='error'
                    title='Live API required'
                    description='Super Admin Approvals uses GET /api/v1/approvals/inbox. Enable the live API to load and refresh records.'
                />
            </section>
        )
    }

    return (
        <section className='space-y-5'>
            <PageHeader
                title='Approval inbox'
                description='Pending workflow items awaiting your role via FastAPI approval engine.'
                context={`${summary.pending} pending · ${summary.highPriority} high-priority pending`}
            />

            <div className='grid grid-cols-2 gap-3 lg:grid-cols-5'>
                {[
                    ['Total', summary.total],
                    ['Pending', summary.pending],
                    ['Approved', summary.approved],
                    ['Rejected', summary.rejected],
                    ['High priority', summary.highPriority],
                ].map(([label, value]) => (
                    <article key={label} className='rounded-xl border border-[var(--erp-line)] bg-white p-4'>
                        <p className='text-xs font-medium uppercase tracking-wide text-[var(--erp-muted)]'>{label}</p>
                        <p className='mt-2 text-2xl font-semibold text-[var(--erp-ink)]'>{value}</p>
                    </article>
                ))}
            </div>

            {refreshNotice ? (
                <div
                    role='status'
                    className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                        refreshNotice.tone === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-red-200 bg-red-50 text-red-800'
                    }`}
                >
                    {refreshNotice.message}
                </div>
            ) : null}

            {error && !refreshing && !refreshNotice ? (
                <FeedbackState kind='error' title='Could not refresh approval records' description={error} />
            ) : null}

            <div className='overflow-hidden rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white'>
                <DataToolbar
                    query={search}
                    onQueryChange={(value) => { setSearch(value); setPage(1) }}
                    searchPlaceholder='Search request, title, requester or department'
                    resultCount={filteredRecords.length}
                    onReset={() => { setSearch(''); setCategory(''); setStatus(''); setPage(1) }}
                    filters={(
                        <>
                            <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Category
                                <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                    <option value=''>All categories</option>
                                    {categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                                </select>
                            </label>
                            <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Status
                                <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                    <option value=''>All statuses</option>
                                    {APPROVAL_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                                </select>
                            </label>
                        </>
                    )}
                    actions={(
                        <>
                            <button
                                type='button'
                                disabled={refreshing || loading}
                                onClick={() => loadInbox({ notifySuccess: true })}
                                className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] px-4 text-sm font-semibold text-[var(--erp-ink)] disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                <RefreshCw
                                    aria-hidden='true'
                                    size={16}
                                    className={refreshing || loading ? 'animate-spin' : undefined}
                                />
                                {refreshing || loading ? 'Refreshing...' : 'Refresh'}
                            </button>
                            <button type='button' disabled title='Export service is not connected' className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] px-4 text-sm font-semibold text-[var(--erp-muted)] opacity-65'>
                                <Download aria-hidden='true' size={16} /> Export unavailable
                            </button>
                        </>
                    )}
                />
                {loading && records.length === 0 ? (
                    <p className='px-4 py-10 text-center text-sm text-[var(--erp-muted)]'>Loading approval inbox…</p>
                ) : (
                    <DataTable
                        caption='Approval requests'
                        rows={pagination.rows}
                        columns={columns}
                        rowKey='id'
                        emptyTitle='No approval requests found'
                        emptyDescription='Inbox is empty for your role, or no requests match the current filters. Refresh pulls the latest GET /api/v1/approvals/inbox response.'
                        renderActions={(request) => (
                            <NavLink to={`${ROUTE_BASE}/view/${request.id}`} className='inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--erp-line-strong)] px-3 text-xs font-semibold text-[var(--erp-ink)]'>
                                Review <ArrowUpRight aria-hidden='true' size={14} />
                            </NavLink>
                        )}
                    />
                )}
                <Pagination {...pagination} pageSizeOptions={[5, 10, 25]} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1) }} />
            </div>
        </section>
    )
}

export default ApprovalsList
