import React from 'react'
import CreateUserPage from '../../../Common/RBAC/CreateUserPage'
import {
    DEFAULT_USER_FORM,
    createUser,
    validateUserCreationForm,
} from '../../../Common/RBAC/createdUsersData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { createAdminUserApi } from '../../../services/api/adminUsersApiService'

const ROUTE_BASE = '/admin/rbac/user-creation'

const AdminCreateUserPage = () => (
    <CreateUserPage
        routeBase={ROUTE_BASE}
        defaultForm={DEFAULT_USER_FORM}
        pageTitle='Create user (Admin)'
        pageDescription={
            'Client rule: school staff logins are created by HR only. '
            + 'Campus Admin cannot provision teachers/PRM/etc. from this screen. '
            + 'Use HR → Employees for staff. Super Admin may create Assistant Admin accounts.'
        }
        submitLabel='Create user'
        successMessage='User created successfully.'
        onSubmit={async (form) => {
            if (!isLiveApiEnabled()) {
                return {
                    success: false,
                    message: 'Live API required. School staff must be created from HR → Employees.',
                }
            }
            const validation = validateUserCreationForm(form)
            if (!validation.success) return validation
            if (!form.role) {
                return { success: false, message: 'Role is required.' }
            }
            if (!form.firstName?.trim() || !form.lastName?.trim()) {
                return { success: false, message: 'First name and last name are required.' }
            }
            if (!form.gender) {
                return { success: false, message: 'Gender is required.' }
            }
            const res = await createAdminUserApi(form, { role: form.role })
            if (!res.success) {
                return {
                    success: false,
                    message: typeof res.error === 'string'
                        ? res.error
                        : 'Server rejected the user create. School staff → HR Employees.',
                }
            }
            return {
                success: true,
                user: res.data,
                temporaryPassword: res.data?.temporaryPassword || null,
            }
        }}
        onSuccess={(result, navigate) => navigate(ROUTE_BASE)}
    />
)

export default AdminCreateUserPage
