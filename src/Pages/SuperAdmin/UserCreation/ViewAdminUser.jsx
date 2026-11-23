import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, KeyRound, Save, ShieldCheck } from 'lucide-react'
import { toast } from 'react-toastify'
import AdminPermissionsPanel from './Components/AdminPermissionsPanel'
import {
    ADMIN_PERMISSION_MODULES,
    ADMIN_ROLE_LABEL,
    ADMIN_USER_STATUSES,
    getAdminUserById,
    getPermissionLabels,
    ROUTE_BASE,
    statusBadgeColor,
    updateAdminUser,
} from './adminUsersData'
import { ConfirmAction, FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { summarizePermissionChanges } from '../../../Common/ui/governance'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    getAdminUser,
    resetAdminUserPassword,
    updateAdminUserApi,
} from '../../../services/api/adminUsersApiService'

const Field = ({ label, value }) => (
    <div className='flex flex-col gap-y-1'>
        <span className='text-base font-medium text-[#808080]'>{label}</span>
        <span className='text-sm text-[#1E1E1E] wrap-break-word'>{value || '—'}</span>
    </div>
)

const ViewAdminUser = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [user, setUser] = useState(() => (live ? null : getAdminUserById(id)))
    const [loading, setLoading] = useState(Boolean(live))
    const [loadError, setLoadError] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [form, setForm] = useState({ status: 'Active', permissions: {} })
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const loadLive = useCallback(async () => {
        setLoading(true)
        setLoadError('')
        const res = await getAdminUser(id)
        setLoading(false)
        if (!res.success) {
            setUser(null)
            setLoadError(typeof res.error === 'string' ? res.error : 'Administrator was not found on the server.')
            return
        }
        setUser(res.data)
        setForm({ status: res.data.status || 'Active', permissions: { ...(res.data.permissions || {}) } })
    }, [id])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            const local = getAdminUserById(id)
            setUser(local)
            setForm({ status: local?.status ?? 'Active', permissions: { ...(local?.permissions ?? {}) } })
            setLoading(false)
            return
        }
        loadLive()
    }, [id, loadLive])

    const togglePermission = (key) => {
        if (live) return
        setForm((prev) => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [key]: !prev.permissions[key],
            },
        }))
    }

    const toggleAllPermissions = (enabled) => {
        if (live) return
        setForm((prev) => ({
            ...prev,
            permissions: Object.fromEntries(
                ADMIN_PERMISSION_MODULES
                    .filter((module) => !module.alwaysOn)
                    .map((module) => [module.key, enabled]),
            ),
        }))
    }

    const handleSave = async () => {
        if (isLiveApiEnabled()) {
            setSaving(true)
            const res = await updateAdminUserApi(id, { status: form.status })
            setSaving(false)
            if (!res.success) {
                setError(typeof res.error === 'string' ? res.error : 'Server rejected the status update.')
                setMessage('')
                return
            }
            setUser(res.data)
            setIsEditing(false)
            setConfirmOpen(false)
            setMessage('Administrator status updated on the server.')
            setError('')
            toast.success('Administrator status saved.')
            return
        }

        const result = updateAdminUser(id, {
            status: form.status,
            permissions: form.permissions,
        })

        if (!result.success) {
            setError(result.message)
            setMessage('')
            return
        }

        setUser(result.user)
        setIsEditing(false)
        setConfirmOpen(false)
        setMessage('Administrator permissions updated successfully.')
        setError('')
    }

    const handleResetPassword = async () => {
        if (!isLiveApiEnabled()) return
        setSaving(true)
        const res = await resetAdminUserPassword(id)
        setSaving(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Password reset failed.')
            return
        }
        const temp = res.data?.temporaryPassword
        toast.success(temp ? `Temporary password: ${temp}` : 'Password reset on the server.')
        setUser(res.data)
    }

    if (loading) {
        return (
            <section className='space-y-6'>
                <button type='button' onClick={() => navigate(ROUTE_BASE)} className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer'>
                    <ArrowLeft size={18} /> Back to list
                </button>
                <FeedbackState kind='loading' title='Loading administrator' description={`Fetching ${id} from the admin users API…`} />
            </section>
        )
    }

    if (!user) {
        return (
            <section className='space-y-6'>
                <button
                    type='button'
                    onClick={() => navigate(ROUTE_BASE)}
                    className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer'
                >
                    <ArrowLeft size={18} />
                    Back to list
                </button>
                <div className='bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]'>
                    {loadError || 'Administrator user not found.'}
                </div>
            </section>
        )
    }

    const permissionLabels = getPermissionLabels(isEditing ? form.permissions : user.permissions)
    const permissionChanges = summarizePermissionChanges(
        user.permissions,
        form.permissions,
        ADMIN_PERMISSION_MODULES,
    )
    const statusChanged = form.status !== user.status

    return (
        <section className='space-y-6'>
            <button
                type='button'
                onClick={() => navigate(ROUTE_BASE)}
                className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer'
            >
                <ArrowLeft size={18} />
                Back to list
            </button>

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex flex-wrap items-center gap-3'>
                    <div className='p-2 rounded-xl bg-[#515DEF]/10 text-[#515DEF]'>
                        <ShieldCheck size={20} />
                    </div>
                    <div className='min-w-0 flex-1'>
                        <h1 className='text-2xl font-semibold text-black'>{user.name}</h1>
                        <p className='text-sm text-[#667085] mt-1'>{user.email}</p>
                    </div>
                    <span className='inline-flex px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#515DEF33] text-[#515DEF]'>
                        {user.roleLabel || ADMIN_ROLE_LABEL}
                    </span>
                    <span className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-semibold ${statusBadgeColor[user.status] || statusBadgeColor.Active}`}>
                        {user.status}
                    </span>
                    {live ? (
                        <button
                            type='button'
                            disabled={saving}
                            onClick={handleResetPassword}
                            className='inline-flex items-center gap-2 rounded-md border border-[#515DEF] px-3 py-1.5 text-sm font-semibold text-[#515DEF] hover:bg-[#F1F2FF] disabled:opacity-60'
                        >
                            <KeyRound size={16} /> Reset password
                        </button>
                    ) : null}
                </div>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-lg font-semibold text-black mb-6'>Account Details</h2>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                    <Field label='Admin ID' value={user.id} />
                    <Field label='Staff / Employee ID' value={user.staffCode || user.employeeId} />
                    <Field label='Department' value={user.department} />
                    <Field label='Username' value={user.username} />
                    <Field label='Mobile Number' value={user.mobileNumber} />
                    <Field label='Created By' value={user.createdBy} />
                    <Field label='Created On' value={user.createdAt} />
                    <Field label='Role' value={user.roleLabel || ADMIN_ROLE_LABEL} />
                    <Field label='Login Email' value={user.email} />
                </div>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex flex-wrap items-center justify-between gap-3 mb-4'>
                    <h2 className='text-lg font-semibold text-black'>{live ? 'Account status' : 'Module Permissions'}</h2>
                    {(!user.isSystem || live) && (
                        <button
                            type='button'
                            onClick={() => {
                                if (isEditing) {
                                    setForm({
                                        status: user.status,
                                        permissions: { ...user.permissions },
                                    })
                                    setIsEditing(false)
                                    setError('')
                                } else {
                                    setIsEditing(true)
                                    setMessage('')
                                }
                            }}
                            className='text-sm font-semibold text-[#515DEF] hover:underline cursor-pointer'
                        >
                            {isEditing ? 'Cancel Edit' : (live ? 'Edit status' : 'Edit Permissions')}
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <>
                        <IntegrationNotice
                            state={live ? 'failed' : 'demo'}
                            title={live ? 'Permission matrix write blocked' : 'Local permission preview'}
                            description={live
                                ? 'Only account status can be updated here. Module permission matrix editing is not available yet.'
                                : 'This preview updates the current browser session only.'}
                            className='mb-5'
                        />
                        <div className='mb-6 max-w-xs'>
                            <label htmlFor='status' className='text-sm font-medium text-[#808080] block mb-2'>Status</label>
                            <select
                                id='status'
                                value={form.status}
                                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                                className='text-sm border border-[#D9D9D9] rounded-md px-3 py-2.5 w-full bg-white focus:outline-none focus:border-[#515DEF]'
                            >
                                {ADMIN_USER_STATUSES.map((item) => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                        </div>
                        {!live ? (
                            <>
                                <AdminPermissionsPanel
                                    permissions={form.permissions}
                                    onToggle={togglePermission}
                                    onToggleAll={toggleAllPermissions}
                                />
                                <div className='mt-5 grid gap-3 sm:grid-cols-2' aria-live='polite'>
                                    <div className='rounded-xl border border-[#4CAF5033] bg-[#4CAF500D] p-3'>
                                        <p className='text-sm font-semibold text-[#257A29]'>Access to grant</p>
                                        <p className='mt-1 text-sm text-[#667085]'>
                                            {permissionChanges.granted.length ? permissionChanges.granted.join(', ') : 'No new module access.'}
                                        </p>
                                    </div>
                                    <div className='rounded-xl border border-[#F4433633] bg-[#F443360D] p-3'>
                                        <p className='text-sm font-semibold text-[#B42318]'>Access to remove</p>
                                        <p className='mt-1 text-sm text-[#667085]'>
                                            {permissionChanges.revoked.length ? permissionChanges.revoked.join(', ') : 'No module access removed.'}
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </>
                ) : (
                    <div className='flex flex-wrap gap-2'>
                        {live ? (
                            <span className='text-sm text-[#667085]'>Server role permissions are fixed for `{user.role || 'admin'}`. Use Edit status to activate or deactivate this login.</span>
                        ) : permissionLabels.length === 0 ? (
                            <span className='text-sm text-[#667085]'>No module permissions assigned.</span>
                        ) : (
                            permissionLabels.map((label) => (
                                <span
                                    key={label}
                                    className='inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#515DEF33] text-[#515DEF]'
                                >
                                    {label}
                                </span>
                            ))
                        )}
                    </div>
                )}
            </div>

            {message && (
                <div className='rounded-xl border border-[#4CAF5033] bg-[#4CAF500D] px-4 py-3 text-sm text-[#4CAF50]'>
                    {message}
                </div>
            )}

            {error && (
                <div className='rounded-xl border border-[#FF572233] bg-[#FF57220D] px-4 py-3 text-sm text-[#FF5722]'>
                    {error}
                </div>
            )}

            {isEditing && (
                <div className='flex sm:justify-end justify-center'>
                    <button
                        type='button'
                        onClick={() => setConfirmOpen(true)}
                        disabled={live ? !statusChanged || saving : (!permissionChanges.changedCount && !statusChanged)}
                        className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60'
                    >
                        <Save size={16} />
                        {live ? (saving ? 'Saving…' : 'Save status') : 'Save Permissions'}
                    </button>
                </div>
            )}

            <ConfirmAction
                open={confirmOpen}
                onClose={() => !saving && setConfirmOpen(false)}
                onConfirm={handleSave}
                title={live ? 'Update administrator status?' : 'Apply access changes?'}
                description={live
                    ? 'This updates the administrator Active/Inactive status.'
                    : 'These changes alter what this administrator can see and operate.'}
                confirmLabel={live ? 'Save status' : 'Apply changes'}
                tone={form.status === 'Inactive' || permissionChanges.revoked.length ? 'danger' : 'primary'}
            >
                <div className='space-y-2'>
                    {!live ? <p><strong>{permissionChanges.granted.length}</strong> module(s) granted and <strong>{permissionChanges.revoked.length}</strong> revoked.</p> : null}
                    {statusChanged && <p>Account status will change from <strong>{user.status}</strong> to <strong>{form.status}</strong>.</p>}
                    {form.status === 'Inactive' && <p>The user will be blocked at the next sign-in check.</p>}
                </div>
            </ConfirmAction>
        </section>
    )
}

export default ViewAdminUser
