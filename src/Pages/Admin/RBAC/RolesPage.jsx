import { useCallback, useEffect, useState } from 'react'
import { Save, ShieldCheck } from 'lucide-react'
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
    Surface,
} from '../../../Common/ui'
import { summarizePermissionChanges } from '../../../Common/ui/governance'
import {
    ROLE_PERMISSION_MODULES,
    buildDefaultRolePermissions,
    getAllRolesForManagement,
    getPermissionsForRole,
    hasPermissionConfigurationForRole,
    setPermissionsForRole,
} from '../../../Common/RBAC/rolePermissionsData'
import { paginateRows } from '../../../Common/ui/dataTableState'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { getRolePermissions } from '../../../services/api/rbacApiService'

const EDITABLE_ROLES = ['teacher', 'coordinator']
const ENFORCED_MODULE_KEYS = ['lessonPlans', 'taskManagement', 'unitTests', 'markEntry', 'deliverables']
const editableModules = ROLE_PERMISSION_MODULES.filter((module) => ENFORCED_MODULE_KEYS.includes(module.key))

const emptyDraft = () => buildDefaultRolePermissions(false)

const RolesPage = () => {
    const live = isLiveApiEnabled()
    const roles = getAllRolesForManagement()
    const [selectedRole, setSelectedRole] = useState('teacher')
    const [savedPermissions, setSavedPermissions] = useState(emptyDraft)
    const [draftPermissions, setDraftPermissions] = useState(emptyDraft)
    const [configured, setConfigured] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [roleQuery, setRoleQuery] = useState('')
    const [catalogPage, setCatalogPage] = useState(1)
    const [catalogPageSize, setCatalogPageSize] = useState(5)
    const [loading, setLoading] = useState(Boolean(live))
    const [loadError, setLoadError] = useState('')
    const [serverPermissionRows, setServerPermissionRows] = useState([])
    const changes = summarizePermissionChanges(savedPermissions, draftPermissions, editableModules)
    const filteredRoles = roles.filter((role) => [role.label, role.id]
        .some((value) => value.toLowerCase().includes(roleQuery.trim().toLowerCase())))
    const rolePagination = paginateRows(filteredRoles, { page: catalogPage, pageSize: catalogPageSize })

    const applyLocalPermissions = useCallback((role, permissions, isConfigured) => {
        const next = {
            ...buildDefaultRolePermissions(false),
            ...(permissions || {}),
        }
        setSelectedRole(role)
        setSavedPermissions(next)
        setDraftPermissions(next)
        setConfigured(Boolean(isConfigured))
        setConfirmOpen(false)
    }, [])

    const loadRole = useCallback(async (role) => {
        if (!isLiveApiEnabled()) {
            setServerPermissionRows([])
            applyLocalPermissions(role, getPermissionsForRole(role), hasPermissionConfigurationForRole(role))
            setLoading(false)
            setLoadError('')
            return
        }
        setLoading(true)
        setLoadError('')
        const res = await getRolePermissions(role)
        setLoading(false)
        if (!res.success) {
            setLoadError(typeof res.error === 'string' ? res.error : 'Failed to load role permissions from the server.')
            setServerPermissionRows([])
            applyLocalPermissions(role, emptyDraft(), false)
            return
        }
        setServerPermissionRows(Array.isArray(res.data?.permissionRows) ? res.data.permissionRows : [])
        // Navigation module toggles are not persisted by the live API — keep draft empty/view-only.
        applyLocalPermissions(role, emptyDraft(), true)
    }, [applyLocalPermissions])

    useEffect(() => {
        loadRole(selectedRole)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [live])

    const chooseRole = (role) => {
        setSelectedRole(role)
        loadRole(role)
    }

    const togglePermission = (key) => {
        if (live) {
            toast.error('Permission matrix write is blocked. Backend exposes read-only /api/v1/admin/roles/{id}/permissions.')
            return
        }
        setDraftPermissions((current) => ({ ...current, [key]: !current[key] }))
    }

    const savePermissions = () => {
        setConfirmOpen(false)
        if (live) {
            toast.error('Permission matrix was not saved. No write API is mounted for navigation modules.')
            return
        }
        setPermissionsForRole(selectedRole, draftPermissions)
        setSavedPermissions(draftPermissions)
        setConfigured(true)
        toast.success('Role navigation policy saved in this browser only (demo mode).')
    }

    const columns = [
        { key: 'label', label: 'Role', required: true, render: (role) => <span className='font-semibold text-[var(--erp-ink)]'>{role.label}</span> },
        { key: 'id', label: 'Role key' },
        {
            key: 'scope',
            label: 'Current UI enforcement',
            render: (role) => EDITABLE_ROLES.includes(role.id)
                ? <StatusBadge status='Active' label={live ? 'Server codes (read-only)' : 'Navigation enforced'} />
                : <StatusBadge status='Pending' label='Backend policy pending' />,
        },
        {
            key: 'configuration',
            label: 'Configuration',
            render: (role) => EDITABLE_ROLES.includes(role.id)
                ? (live ? 'Server permission codes' : (hasPermissionConfigurationForRole(role.id) ? 'Custom policy' : 'Existing navigation fallback'))
                : 'View only',
        },
    ]

    const grantedServerRows = serverPermissionRows.filter((row) => row.granted)

    return (
        <section className='space-y-5'>
            <PageHeader
                title='Roles and access'
                description='Review every ERP role and configure the module navigation currently enforced by this frontend.'
                context={`${roles.length} system roles · 2 roles with UI-enforced module policy`}
            />

            <IntegrationNotice
                state={live ? (loadError ? 'failed' : 'connected') : 'demo'}
                title={live ? (loadError ? 'Permission matrix load failed' : 'Live RBAC is read-only') : 'Frontend policy prototype'}
                description={live
                    ? (loadError
                        ? loadError
                        : 'Live mode loads GET /api/v1/admin/roles/{id}/permissions (permission codes). Navigation-module toggles are not writable — FastAPI has no mounted PATCH for this matrix. Success toasts are never shown for blocked writes.')
                    : 'Teacher and Coordinator navigation policies are stored in this browser only. Live API mode blocks writes until a backend write contract exists.'}
            />

            {loading ? <FeedbackState kind='loading' title='Loading permissions' description='Fetching role matrix…' /> : null}

            <div className='grid grid-cols-1 gap-5 xl:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)]'>
                <Surface title='Editable role policy' description={live ? 'Module toggles are view-only while live. Use the server grant list below for authoritative codes.' : 'Choose a supported role, then review access consequences before saving.'} contentClassName='p-4 sm:p-5'>
                    <label className='grid gap-1.5 text-sm font-semibold text-[var(--erp-ink)]'>Role
                        <select value={selectedRole} onChange={(event) => chooseRole(event.target.value)} className='min-h-11 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm' disabled={loading}>
                            <option value='teacher'>Teacher</option>
                            <option value='coordinator'>Coordinator</option>
                        </select>
                    </label>

                    <div className='mt-5 rounded-xl border border-[var(--erp-line)] bg-[var(--erp-canvas)] p-4'>
                        <div className='flex items-center gap-2'>
                            <ShieldCheck aria-hidden='true' size={18} className='text-[var(--erp-indigo)]' />
                            <p className='text-sm font-semibold text-[var(--erp-ink)]'>Dashboard access is always on</p>
                        </div>
                        <p className='mt-1 text-xs text-[var(--erp-muted)]'>This prevents a role from losing its safe landing page.</p>
                    </div>

                    <fieldset className='mt-5 space-y-2' disabled={live || loading}>
                        <legend className='mb-2 text-sm font-semibold text-[var(--erp-ink)]'>Module navigation</legend>
                        {editableModules.map((module) => (
                            <label key={module.key} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 ${live ? 'opacity-80' : 'cursor-pointer'} ${draftPermissions[module.key] ? 'border-[var(--erp-indigo)] bg-[var(--erp-indigo-soft)]' : 'border-[var(--erp-line)] bg-white'}`}>
                                <span>
                                    <span className='block text-sm font-semibold text-[var(--erp-ink)]'>{module.label}</span>
                                    <span className='block text-xs text-[var(--erp-muted)]'>{draftPermissions[module.key] ? 'Visible in role navigation' : 'Hidden from role navigation'}</span>
                                </span>
                                <input type='checkbox' checked={Boolean(draftPermissions[module.key])} onChange={() => togglePermission(module.key)} readOnly={live} className='size-4 accent-[var(--erp-indigo)]' />
                            </label>
                        ))}
                    </fieldset>

                    {live && !loadError && (
                        <div className='mt-5 rounded-xl border border-[var(--erp-line)] bg-white p-4'>
                            <p className='text-sm font-semibold text-[var(--erp-ink)]'>Server permission codes ({grantedServerRows.length} granted)</p>
                            <p className='mt-1 text-xs text-[var(--erp-muted)]'>Authoritative grants from GET /api/v1/admin/roles/{selectedRole}/permissions.</p>
                            <ul className='mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-[var(--erp-slate)]'>
                                {grantedServerRows.length === 0 ? (
                                    <li>No granted codes returned for this role.</li>
                                ) : grantedServerRows.map((row) => (
                                    <li key={row.code}><code className='text-[var(--erp-ink)]'>{row.code}</code> — {row.description || 'granted'}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!live && (
                        <div className='mt-5 grid gap-3 sm:grid-cols-2' aria-live='polite'>
                            <div className='rounded-xl border border-[#4CAF5033] bg-[#4CAF500D] p-3'>
                                <p className='text-sm font-semibold text-[#257A29]'>Will gain access</p>
                                <p className='mt-1 text-xs text-[var(--erp-slate)]'>{changes.granted.join(', ') || 'No new modules'}</p>
                            </div>
                            <div className='rounded-xl border border-[#F4433633] bg-[#F443360D] p-3'>
                                <p className='text-sm font-semibold text-[#B42318]'>Will lose access</p>
                                <p className='mt-1 text-xs text-[var(--erp-slate)]'>{changes.revoked.join(', ') || 'No removed modules'}</p>
                            </div>
                        </div>
                    )}

                    {!configured && !live && (
                        <p className='mt-4 rounded-xl border border-[#FF980044] bg-[#FFF8E8] p-3 text-sm text-[#8A4B08]'>
                            This role currently uses its existing navigation. Saving with every box cleared will explicitly hide all optional modules.
                        </p>
                    )}

                    <button
                        type='button'
                        onClick={() => setConfirmOpen(true)}
                        disabled={live || loading || (configured && changes.changedCount === 0)}
                        className='mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45'
                    >
                        <Save aria-hidden='true' size={16} /> {live ? 'Save blocked in live mode' : 'Review and save policy'}
                    </button>
                </Surface>

                <Surface title='System role catalog' description='Roles outside the supported frontend policy editor remain view-only until a write contract exists.'>
                    <DataToolbar
                        query={roleQuery}
                        onQueryChange={(value) => { setRoleQuery(value); setCatalogPage(1) }}
                        searchPlaceholder='Search system roles'
                        resultCount={filteredRoles.length}
                        onReset={() => { setRoleQuery(''); setCatalogPage(1) }}
                    />
                    <DataTable caption='System roles' rows={rolePagination.rows} columns={columns} rowKey='id' />
                    <Pagination
                        {...rolePagination}
                        onPageChange={setCatalogPage}
                        onPageSizeChange={(value) => { setCatalogPageSize(value); setCatalogPage(1) }}
                        pageSizeOptions={[5, 10, 25]}
                    />
                </Surface>
            </div>

            <ConfirmAction
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={savePermissions}
                title={`Apply ${selectedRole} access policy?`}
                description='The role navigation will change immediately in this browser only.'
                confirmLabel='Apply policy'
                tone={changes.revoked.length || (!configured && changes.granted.length === 0) ? 'danger' : 'primary'}
            >
                <div className='space-y-2'>
                    <p><strong>{changes.granted.length}</strong> module(s) granted and <strong>{changes.revoked.length}</strong> revoked.</p>
                    {!configured && changes.granted.length === 0 && <p>This creates an explicit deny-all policy for optional modules.</p>}
                    <p>Users keep dashboard access. Server-side permission enforcement is still required before production use.</p>
                </div>
            </ConfirmAction>
        </section>
    )
}

export default RolesPage
