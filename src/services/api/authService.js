/**
 * Live backend authentication against FastAPI /api/v1/auth/*
 * Used when VITE_USE_MOCK=false and VITE_API_BASE_URL is set.
 */

import { apiClient } from './apiClient.js'
import { clearAccessToken, getAccessToken, setAccessToken } from './tokenStore.js'
import { ROLE_HOME_PATHS, ROLES } from '../../constants/roles.js'

/** Known local-dev seed accounts from backend/.env.example (development only). */
export const BACKEND_SEED_DIRECTORY = Object.freeze([
  { email: 'admin@qmis.edu', password: 'admin123', role: ROLES.ADMIN, roleLabel: 'Admin', name: 'Admin (seed)' },
  { email: 'superadmin@qmis.edu', password: 'superadmin123', role: ROLES.SUPER_ADMIN, roleLabel: 'Super Admin', name: 'Super Admin (seed)' },
  { email: 'hr@qmis.edu', password: 'hr12345', role: ROLES.HR, roleLabel: 'HR', name: 'HR (seed)' },
  { email: 'accounthead@qmis.edu', password: 'accounts123', role: ROLES.ACCOUNT_HEAD, roleLabel: 'Account Head', name: 'Account Head (seed)' },
  { email: 'finance.assistant@qmis.edu', password: 'finance123', role: ROLES.ACCOUNT_HEAD, roleLabel: 'Finance Assistant', name: 'Finance Assistant (seed)' },
  { email: 'teacher@qmis.edu', password: 'teacher123', role: ROLES.TEACHER, roleLabel: 'Teacher', name: 'Teacher (seed)' },
  { email: 'coordinator@qmis.edu', password: 'coord123', role: ROLES.COORDINATOR, roleLabel: 'Coordinator', name: 'Coordinator (seed)' },
  { email: 'principal@qmis.edu', password: 'principal123', role: ROLES.PRINCIPAL, roleLabel: 'Principal', name: 'Principal (seed)' },
  { email: 'prm@qmis.edu', password: 'prm12345', role: ROLES.PRM, roleLabel: 'PRM / Front Office', name: 'PRM (seed)' },
  { email: 'director@qmis.edu', password: 'director123', role: ROLES.DIRECTOR, roleLabel: 'Director', name: 'Director (seed)' },
])

const KNOWN_FRONTEND_ROLES = new Set(Object.values(ROLES))

function extractErrorMessage(payload, fallback = 'Authentication failed.') {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  if (payload.message) return payload.message
  if (payload.error) return String(payload.error)
  if (payload.detail) {
    if (typeof payload.detail === 'string') return payload.detail
    if (payload.detail.message) return payload.detail.message
    if (Array.isArray(payload.detail)) {
      return payload.detail.map((d) => d.msg || d.message || JSON.stringify(d)).join('; ')
    }
  }
  return fallback
}

function mapBackendRole(roleCode) {
  if (!roleCode) return null
  const normalized = String(roleCode).trim().toLowerCase()
  if (normalized === 'vandriver') return ROLES.DRIVER
  if (KNOWN_FRONTEND_ROLES.has(normalized)) return normalized
  return null
}

function buildSessionUser(me, role) {
  const email = me?.email || ''
  const profile = me?.profile || {}
  const name =
    profile.name ||
    me?.full_name ||
    me?.name ||
    (email ? email.split('@')[0] : 'User')
  return {
    id: me?.id != null ? String(me.id) : email,
    email,
    name,
    role,
    roleLabel: me?.role_name || me?.role_label || role,
    department: profile.department || me?.department || me?.campus?.name || 'Queen Mira International School',
    designation: profile.designation || me?.designation || me?.role_name || role,
    employeeId: profile.staffCode || me?.employee_code || me?.staff_code || (me?.id != null ? String(me.id) : undefined),
    status: profile.status || (me?.is_active === false ? 'Inactive' : 'Active'),
    permissions: me?.permissions || [],
    campus: me?.campus || null,
    mustChangePassword: Boolean(me?.must_change_password),
    profile,
    source: 'backend',
  }
}

/**
 * POST /api/v1/auth/login then GET /api/v1/auth/me
 */
export async function loginWithBackend(identifier, password, rememberMe = false) {
  const email = String(identifier || '').trim().toLowerCase()
  if (!email) {
    return { success: false, message: 'Please enter your Email Address.' }
  }
  if (!password) {
    return { success: false, message: 'Please enter your password.' }
  }

  const loginRes = await apiClient.post(
    '/api/v1/auth/login',
    { email, password },
    { skipMock: true, skipDelay: true }
  )

  if (!loginRes.success) {
    return {
      success: false,
      message: extractErrorMessage(loginRes.error || loginRes.data, 'Invalid email or password.'),
    }
  }

  const tokenBody = loginRes.data || {}
  const accessToken = tokenBody.access_token
  if (!accessToken) {
    return { success: false, message: 'Login succeeded but no access token was returned.' }
  }

  setAccessToken(accessToken, rememberMe)

  const meRes = await apiClient.get('/api/v1/auth/me', { skipMock: true, skipDelay: true })
  if (!meRes.success) {
    clearAccessToken()
    return {
      success: false,
      message: extractErrorMessage(meRes.error || meRes.data, 'Could not load your profile.'),
    }
  }

  const me = meRes.data || {}
  const role = mapBackendRole(me.role || tokenBody.role)
  if (!role) {
    clearAccessToken()
    return {
      success: false,
      message: `Signed in, but role "${me.role || tokenBody.role || 'unknown'}" is not mapped in this UI.`,
    }
  }

  if (me.is_active === false) {
    clearAccessToken()
    return { success: false, message: 'This account is inactive. Contact IT Helpdesk.' }
  }

  const user = buildSessionUser(me, role)
  return {
    success: true,
    accessToken,
    mustChangePassword: Boolean(tokenBody.must_change_password || me.must_change_password),
    user,
    role,
    homePath: ROLE_HOME_PATHS[role] ?? '/dashboard',
  }
}

export async function fetchCurrentUser() {
  const token = getAccessToken()
  if (!token) return { success: false, message: 'Not authenticated.' }

  const meRes = await apiClient.get('/api/v1/auth/me', { skipMock: true, skipDelay: true })
  if (!meRes.success) {
    return {
      success: false,
      message: extractErrorMessage(meRes.error || meRes.data, 'Session expired.'),
      status: 401,
    }
  }
  const me = meRes.data || {}
  const role = mapBackendRole(me.role)
  if (!role) {
    return { success: false, message: `Role "${me.role}" is not mapped in this UI.` }
  }
  return { success: true, user: buildSessionUser(me, role), role }
}

export async function logoutFromBackend() {
  try {
    if (getAccessToken()) {
      await apiClient.post('/api/v1/auth/logout', {}, { skipMock: true, skipDelay: true })
    }
  } catch {
    // Client must still discard the token even if audit logout fails.
  } finally {
    clearAccessToken()
  }
  return { success: true }
}

export async function checkBackendHealth() {
  const res = await apiClient.get('/health', { skipMock: true, skipDelay: true })
  return res
}
