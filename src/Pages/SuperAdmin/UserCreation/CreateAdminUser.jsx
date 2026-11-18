import React from 'react'
import CreateUserPage from '../../../Common/RBAC/CreateUserPage'
import { ROLES } from '../../../constants/roles'
import {
    ADMIN_ROLE_LABEL,
    createAdminUser,
    DEFAULT_ADMIN_USER_FORM,
    ROUTE_BASE,
} from './adminUsersData'
import { validateUserCreationForm } from '../../../Common/RBAC/createdUsersData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { createAdminUserApi } from '../../../services/api/adminUsersApiService'

const CreateAdminUser = () => (
    <CreateUserPage
        routeBase={ROUTE_BASE}
        defaultForm={DEFAULT_ADMIN_USER_FORM}
        fixedRole={ROLES.ADMIN}
        fixedRoleLabel={ADMIN_ROLE_LABEL}
        pageTitle='Create Admin User'
        pageDescription='Create an Administrator account with the full user profile. Role is fixed to Administrator for Super Admin user creation.'
        submitLabel='Create Admin User'
        successMessage='Admin user created successfully.'
        onSubmit={async (form) => {
            if (!isLiveApiEnabled()) {
                return createAdminUser(form)
            }
            const validation = validateUserCreationForm(form)
            if (!validation.success) return validation
            if (!form.firstName?.trim() || !form.lastName?.trim()) {
                return { success: false, message: 'First name and last name are required.' }
            }
            if (!form.gender) {
                return { success: false, message: 'Gender is required.' }
            }
            const res = await createAdminUserApi(form, { role: 'admin' })
            if (!res.success) {
                return { success: false, message: typeof res.error === 'string' ? res.error : 'Server rejected the administrator create.' }
            }
            return {
                success: true,
                user: res.data,
                temporaryPassword: res.data?.temporaryPassword || null,
            }
        }}
        onSuccess={(result, navigate) => navigate(`${ROUTE_BASE}/view/${result.user.id}`)}
    />
)

export default CreateAdminUser
