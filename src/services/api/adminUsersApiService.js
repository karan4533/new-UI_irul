/**
 * Live Admin / staff user provisioning — FastAPI /api/v1/admin/users*
 * Shared by Super Admin (and later Admin RBAC). No mock fallback.
 */

import { apiClient } from './apiClient.js'
import { isLiveApiEnabled } from './tokenStore.js'

function requireLive() {
  if (!isLiveApiEnabled()) {
    return {
      success: false,
      error: 'Live API is disabled. Set VITE_USE_MOCK=false and VITE_API_BASE_URL.',
      data: null,
    }
  }
  return null
}

export function mapAdminUserToUi(row = {}) {
  return {
    id: row.id,
    staffCode: row.staffCode || '',
    employeeId: row.staffCode || row.id,
    name: row.name || [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '),
    firstName: row.firstName || '',
    middleName: row.middleName || '',
    lastName: row.lastName || '',
    email: row.email || '',
    mobileNumber: row.mobileNumber || '',
    department: row.department || row.details?.department || 'Administration',
    role: row.role || '',
    roleLabel: row.roleLabel || row.role || '',
    status: row.status || 'Active',
    username: row.username || row.details?.username || row.email || '',
    gender: row.gender || '',
    mustChangePassword: Boolean(row.mustChangePassword),
    temporaryPassword: row.temporaryPassword || null,
    details: row.details || {},
    createdAt: row.createdAt || row.created_at || '',
    permissions: row.permissions || {},
    source: 'backend',
  }
}

export async function listAdminUsers(params = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const query = {}
  if (params.role) query.role = params.role
  if (params.status) query.status = params.status
  if (params.q) query.q = params.q
  if (params.limit != null) query.limit = params.limit
  if (params.offset != null) query.offset = params.offset
  const res = await apiClient.get('/api/v1/admin/users', { skipMock: true, params: query, ...options })
  if (!res.success) return res
  const rows = Array.isArray(res.data) ? res.data.map(mapAdminUserToUi) : []
  return { ...res, data: rows }
}

export async function getAdminUser(userId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/admin/users/${encodeURIComponent(userId)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapAdminUserToUi(res.data || {}) }
}

export async function listCreatableRoles(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/admin/users/creatable-roles', { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: Array.isArray(res.data) ? res.data : [] }
}

export function uiFormToUserCreate(form, { role = 'admin' } = {}) {
  return {
    role,
    firstName: String(form.firstName || '').trim(),
    middleName: String(form.middleName || '').trim(),
    lastName: String(form.lastName || '').trim(),
    email: String(form.email || '').trim().toLowerCase(),
    gender: form.gender || 'Other',
    mobileNumber: String(form.mobileNumber || '').trim(),
    status: form.status === 'Inactive' ? 'Inactive' : 'Active',
    password: form.password?.trim() || null,
    street: form.street || null,
    city: form.city || null,
    state: form.state || null,
    country: form.country || null,
    pincode: form.pincode || null,
    qualification: form.qualification || null,
    yearsOfExperience: form.yearsOfExperience || null,
    previousSchool: form.previousSchool || null,
    joiningDate: form.joiningDate || null,
    dateOfBirth: form.dateOfBirth || null,
    username: form.username || null,
    alternativeMobileNumber: form.alternativeMobileNumber || null,
    fatherName: form.fatherName || null,
    motherName: form.motherName || null,
    familyContactNumber: form.familyContactNumber || null,
    bloodGroup: form.bloodGroup || null,
    medicalHistory: form.medicalHistory || null,
  }
}

export async function createAdminUserApi(form, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const payload = uiFormToUserCreate(form, { role: options.role || 'admin' })
  const res = await apiClient.post('/api/v1/admin/users', payload, { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: mapAdminUserToUi(res.data || {}) }
}

export async function updateAdminUserApi(userId, changes, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.patch(`/api/v1/admin/users/${encodeURIComponent(userId)}`, changes, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapAdminUserToUi(res.data || {}) }
}

export async function resetAdminUserPassword(userId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/reset-password`,
    {},
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapAdminUserToUi(res.data || {}) }
}
