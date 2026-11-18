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
        pageTitle='Create staff user'
        pageDescription='Provision a campus staff login. Role must be one the Administrator is allowed to create.'
        submitLabel='Create user'
        successMessage='Staff user created successfully.'
        onSubmit={async (form) => {
            if (!isLiveApiEnabled()) {
                return createUser(form)
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
                return { success: false, message: typeof res.error === 'string' ? res.error : 'Server rejected the user create.' }
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
