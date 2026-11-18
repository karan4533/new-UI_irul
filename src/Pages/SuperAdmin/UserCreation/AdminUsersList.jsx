import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Download, Plus } from 'lucide-react'
import { NavLink, useSearchParams } from 'react-router-dom'
import {
    DataTable,
    DataToolbar,
    FeedbackState,
    IntegrationNotice,
    PageHeader,
    Pagination,
    StatusBadge,
} from '../../../Common/ui'
import { paginateRows, parseTableState, serializeTableState } from '../../../Common/ui/dataTableState'
import {
    ADMIN_USER_STATUSES,
    filterAdminUsers,
    getAdminUserSummary,
    getAllAdminUsers,
    getPermissionCount,
    ROUTE_BASE,
} from './adminUsersData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listAdminUsers } from '../../../services/api/adminUsersApiService'

const AdminUsersList = () => {
    const live = isLiveApiEnabled()
    const [urlParams, setUrlParams] = useSearchParams()
    const initialTableState = parseTableState(urlParams)
    const [records, setRecords] = useState(() => (live ? [] : getAllAdminUsers()))
    const [listLoading, setListLoading] = useState(Boolean(live))
    const [listError, setListError] = useState('')
    const [listSource, setListSource] = useState(live ? 'backend' : 'local')
    const [search, setSearch] = useState(initialTableState.query)
    const [status, setStatus] = useState(initialTableState.filters.status || '')
    const [page, setPage] = useState(initialTableState.page)
    const [pageSize, setPageSize] = useState(initialTableState.pageSize)

    const loadLive = useCallback(async () => {
        setListLoading(true)
        setListError('')
        const res = await listAdminUsers({ role: 'admin', limit: 500 })
        setListLoading(false)
        if (!res.success) {
            setListSource('error')
            setListError(typeof res.error === 'string' ? res.error : 'Failed to load administrator accounts.')
            setRecords([])
            return
        }
        setRecords(Array.isArray(res.data) ? res.data : [])
        setListSource('backend')
    }, [])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setRecords(getAllAdminUsers())
            setListSource('local')
            setListLoading(false)
            setListError('')
            return
        }
        loadLive()
    }, [loadLive])

    const summary = useMemo(() => getAdminUserSummary(records), [records])
    const filteredRecords = useMemo(
        () => filterAdminUsers(records, { search, status }),
        [records, search, status],
    )
    const pagination = paginateRows(filteredRecords, { page, pageSize })

    useEffect(() => {
        setUrlParams(serializeTableState({
            query: search,
            page: pagination.page,
            pageSize,
            filters: { status },
        }), { replace: true })
    }, [pageSize, pagination.page, search, setUrlParams, status])

    const columns = [
        { key: 'name', label: 'Administrator', required: true, render: (user) => <span><span className='block font-semibold text-[var(--erp-ink)]'>{user.name}</span><span className='block text-xs text-[var(--erp-muted)]'>{user.staffCode || user.id}</span></span> },
        { key: 'email', label: 'Email' },
        { key: 'department', label: 'Department', render: (user) => user.department || '—' },
        {
            key: 'permissions',
            label: live ? 'Role' : 'Module scope',
            render: (user) => (live
                ? (user.roleLabel || user.role || 'Administrator')
                : `${getPermissionCount(user.permissions)} optional modules`),
        },
        { key: 'status', label: 'Status', render: (user) => <StatusBadge status={user.status} /> },
        { key: 'createdAt', label: 'Created', render: (user) => user.createdAt || '—' },
    ]

    return (
        <section className='space-y-5'>
            <PageHeader
                title='Administrator accounts'
                description='Provision Administrator portal identities and review each account’s module scope.'
                context={`${summary.total} total · ${summary.active} active · ${summary.inactive} inactive`}
                actions={(
                    <NavLink to={`${ROUTE_BASE}/add`} className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white'>
                        <Plus aria-hidden='true' size={16} /> Create administrator
                    </NavLink>
                )}
            />

            <IntegrationNotice
                state={listSource === 'backend' ? 'connected' : listSource === 'error' ? 'failed' : 'demo'}
                title={listSource === 'backend' ? 'Live administrator directory' : listSource === 'error' ? 'Administrator API unavailable' : 'Browser-stored administrator directory'}
                description={listSource === 'backend'
                    ? 'GET /api/v1/admin/users?role=admin · create via POST /api/v1/admin/users. Per-module permission toggles are not writable on the server.'
                    : listSource === 'error'
                        ? listError
                        : 'Profiles and module policies are local to this browser. Production provisioning, invitations, audit trails and API authorization are not connected.'}
            />

            {listLoading ? (
                <FeedbackState kind='loading' title='Loading administrators' description='Fetching from the admin users API…' />
            ) : null}

            {!listLoading && listSource !== 'error' ? (
                <>
                    <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
                        {[
                            ['Total accounts', summary.total],
                            ['Active', summary.active],
                            ['Inactive', summary.inactive],
                            [live ? 'Server roles' : 'Custom created', live ? 'admin' : summary.custom],
                        ].map(([label, value]) => (
                            <article key={label} className='rounded-xl border border-[var(--erp-line)] bg-white p-4'>
                                <p className='text-xs font-medium uppercase tracking-wide text-[var(--erp-muted)]'>{label}</p>
                                <p className='mt-2 text-2xl font-semibold text-[var(--erp-ink)]'>{value}</p>
                            </article>
                        ))}
                    </div>

                    <div className='overflow-hidden rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white'>
                        <DataToolbar
                            query={search}
                            onQueryChange={(value) => { setSearch(value); setPage(1) }}
                            searchPlaceholder='Search name, email, ID or department'
                            resultCount={filteredRecords.length}
                            onReset={() => { setSearch(''); setStatus(''); setPage(1) }}
                            filters={(
                                <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Status
                                    <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                        <option value=''>All statuses</option>
                                        {ADMIN_USER_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                                    </select>
                                </label>
                            )}
                            actions={(
                                <button type='button' disabled title='Export service is not connected' className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] px-4 text-sm font-semibold text-[var(--erp-muted)] opacity-65'>
                                    <Download aria-hidden='true' size={16} /> Export unavailable
                                </button>
                            )}
                        />
                        <DataTable
                            caption='Administrator accounts'
                            rows={pagination.rows}
                            columns={columns}
                            rowKey='id'
                            emptyTitle='No administrator accounts found'
                            emptyDescription='No accounts match the current search and status filter.'
                            renderActions={(user) => (
                                <NavLink to={`${ROUTE_BASE}/view/${user.id}`} className='inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--erp-line-strong)] px-3 text-xs font-semibold text-[var(--erp-ink)]'>
                                    Review access <ArrowUpRight aria-hidden='true' size={14} />
                                </NavLink>
                            )}
                        />
                        <Pagination
                            page={pagination.page}
                            pageCount={pagination.pageCount}
                            pageSize={pageSize}
                            total={pagination.total}
                            from={pagination.from}
                            to={pagination.to}
                            onPageChange={setPage}
                            onPageSizeChange={(value) => { setPageSize(value); setPage(1) }}
                        />
                    </div>
                </>
            ) : null}
        </section>
    )
}

export default AdminUsersList
