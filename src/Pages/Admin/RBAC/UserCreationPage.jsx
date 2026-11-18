import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, ShieldCheck, UserRoundCheck, UserRoundX } from 'lucide-react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
    ConfirmAction,
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
    CREATABLE_ROLE_LABELS,
    CREATABLE_ROLE_OPTIONS,
    deleteCreatedUser,
    getAllCreatedUsers,
    updateUserStatus,
} from '../../../Common/RBAC/createdUsersData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listAdminUsers, updateAdminUserApi } from '../../../services/api/adminUsersApiService'

const ROUTE_BASE = '/admin/rbac/user-creation'

const UserCreationPage = () => {
    const live = isLiveApiEnabled()
    const [urlParams, setUrlParams] = useSearchParams()
    const initialTableState = parseTableState(urlParams)
    const [users, setUsers] = useState(() => (live ? [] : getAllCreatedUsers()))
    const [listLoading, setListLoading] = useState(Boolean(live))
    const [listError, setListError] = useState('')
    const [listSource, setListSource] = useState(live ? 'backend' : 'local')
    const [search, setSearch] = useState(initialTableState.query)
    const [role, setRole] = useState(initialTableState.filters.role || '')
    const [status, setStatus] = useState(initialTableState.filters.status || '')
    const [page, setPage] = useState(initialTableState.page)
    const [pageSize, setPageSize] = useState(initialTableState.pageSize)
    const [pendingAction, setPendingAction] = useState(null)
    const [saving, setSaving] = useState(false)
    const [refreshNonce, setRefreshNonce] = useState(0)

    const loadLive = useCallback(async () => {
        setListLoading(true)
        setListError('')
        const res = await listAdminUsers({ limit: 500 })
        setListLoading(false)
        if (!res.success) {
            setListSource('error')
            setListError(typeof res.error === 'string' ? res.error : 'Failed to load users from the API.')
            setUsers([])
            return
        }
        setUsers(Array.isArray(res.data) ? res.data : [])
        setListSource('backend')
    }, [])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setUsers(getAllCreatedUsers())
            setListSource('local')
            setListLoading(false)
            setListError('')
            return
        }
        loadLive()
    }, [loadLive, refreshNonce])

    const filteredUsers = useMemo(() => {
        const query = search.trim().toLowerCase()
        return users.filter((user) => {
            if (role && user.role !== role) return false
            if (status && user.status !== status) return false
            if (!query) return true
            return [user.id, user.staffCode, user.name, user.email, user.role, user.className, user.section]
                .some((value) => String(value || '').toLowerCase().includes(query))
        })
    }, [role, search, status, users])
    const pagination = paginateRows(filteredUsers, { page, pageSize })

    useEffect(() => {
        setUrlParams(serializeTableState({
            query: search,
            page: pagination.page,
            pageSize,
            filters: { role, status },
        }), { replace: true })
    }, [pageSize, pagination.page, role, search, setUrlParams, status])

    const confirmPendingAction = async () => {
        if (!pendingAction) return
        const { type, user } = pendingAction

        if (isLiveApiEnabled()) {
            if (type === 'delete') {
                toast.error('Hard delete is not supported. Deactivate the account instead.')
                setPendingAction(null)
                return
            }
            const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active'
            setSaving(true)
            const res = await updateAdminUserApi(user.id, { status: nextStatus })
            setSaving(false)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Could not update status on the server.')
                return
            }
            toast.success(`User marked as ${nextStatus} on the server.`)
            setPendingAction(null)
            setRefreshNonce((n) => n + 1)
            return
        }

        if (type === 'delete') {
            deleteCreatedUser(user.id)
            toast.success('User removed from this browser dataset.')
        } else {
            const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active'
            updateUserStatus(user.id, nextStatus)
            toast.success(`User marked as ${nextStatus}.`)
        }
        setUsers(getAllCreatedUsers())
        setPendingAction(null)
    }

    const resetFilters = () => {
        setSearch('')
        setRole('')
        setStatus('')
        setPage(1)
    }

    const columns = [
        { key: 'name', label: 'User', required: true, render: (user) => <span><span className='block font-semibold text-[var(--erp-ink)]'>{user.name}</span><span className='block text-xs text-[var(--erp-muted)]'>{user.staffCode || user.id}</span></span> },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', render: (user) => user.roleLabel || CREATABLE_ROLE_LABELS[user.role] || user.role },
        { key: 'class', label: 'Class scope', render: (user) => user.className && user.section ? `${user.className}-${user.section}` : (user.details?.className ? `${user.details.className}` : 'Not class-scoped') },
        { key: 'status', label: 'Status', render: (user) => <StatusBadge status={user.status} /> },
    ]

    return (
        <section className='space-y-5'>
            <PageHeader
                title='User provisioning'
                description='Create staff identities, review account state and manage access lifecycle.'
                context={`${users.length} created · ${users.filter((user) => user.status === 'Active').length} active`}
                actions={(
                    <NavLink to={`${ROUTE_BASE}/add`} className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white'>
                        <Plus aria-hidden='true' size={16} /> Create user
                    </NavLink>
                )}
            />

            <IntegrationNotice
                state={listSource === 'backend' ? 'connected' : listSource === 'error' ? 'failed' : 'demo'}
                title={listSource === 'backend' ? 'Live staff directory' : listSource === 'error' ? 'Users API unavailable' : 'Local account directory'}
                description={listSource === 'backend'
                    ? 'GET/POST/PATCH /api/v1/admin/users. Hard delete is not available — deactivate only. Role permission matrix edits remain blocked.'
                    : listSource === 'error'
                        ? listError
                        : 'Accounts and status changes are stored in this browser. Production identity provisioning requires the authentication backend.'}
            />

            {listLoading ? (
                <FeedbackState kind='loading' title='Loading users' description='Fetching from the admin users API…' />
            ) : null}

            {!listLoading && listSource !== 'error' ? (
                <div className='overflow-hidden rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white'>
                    <DataToolbar
                        query={search}
                        onQueryChange={(value) => { setSearch(value); setPage(1) }}
                        searchPlaceholder='Search name, email or user ID'
                        resultCount={filteredUsers.length}
                        onReset={resetFilters}
                        filters={(
                            <>
                                <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Role
                                    <select value={role} onChange={(event) => { setRole(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                        <option value=''>All roles</option>
                                        {CREATABLE_ROLE_OPTIONS.map((option) => <option key={option.role} value={option.role}>{option.label}</option>)}
                                    </select>
                                </label>
                                <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Status
                                    <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                                        <option value=''>All statuses</option>
                                        <option value='Active'>Active</option>
                                        <option value='Inactive'>Inactive</option>
                                    </select>
                                </label>
                            </>
                        )}
                    />
                    <DataTable
                        caption='Provisioned users'
                        rows={pagination.rows}
                        columns={columns}
                        rowKey='id'
                        emptyTitle='No users found'
                        emptyDescription='No created users match the current filters.'
                        renderActions={(user) => (
                            <button type='button' onClick={() => setPendingAction({ type: 'status', user })} className='inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--erp-line-strong)] px-3 text-xs font-semibold text-[var(--erp-indigo)]'>
                                {user.status === 'Active' ? <UserRoundX aria-hidden='true' size={14} /> : <UserRoundCheck aria-hidden='true' size={14} />}
                                {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                            </button>
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
            ) : null}

            <ConfirmAction
                open={Boolean(pendingAction)}
                onClose={() => !saving && setPendingAction(null)}
                onConfirm={confirmPendingAction}
                title={`${pendingAction?.user?.status === 'Active' ? 'Deactivate' : 'Activate'} this user?`}
                description={live
                    ? 'This sends PATCH /api/v1/admin/users/{id} with Active or Inactive status.'
                    : 'The user’s sign-in eligibility will change in this browser dataset.'}
                confirmLabel='Confirm status change'
                tone={pendingAction?.user?.status === 'Active' ? 'danger' : 'primary'}
            >
                <div className='flex items-start gap-2'>
                    <ShieldCheck aria-hidden='true' size={18} className='mt-0.5 shrink-0 text-[var(--erp-indigo)]' />
                    <p>{live ? 'Production deactivation blocks new sign-ins. Accounts are never hard-deleted.' : 'Any future backend implementation should archive the identity and retain audit history instead of hard-deleting it.'}</p>
                </div>
            </ConfirmAction>
        </section>
    )
}

export default UserCreationPage
