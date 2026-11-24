/**
 * Live RBAC reads — FastAPI /api/v1/admin/roles*
 *
 * Authoritative grants are permission codes (auth.me, lessonplans.write, …).
 * There is no mounted write API for the frontend navigation module matrix
 * (lessonPlans / taskManagement / …). Callers must not toast success on writes.
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

export async function listRbacRoles(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/admin/roles', { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: Array.isArray(res.data) ? res.data : [] }
}

/**
 * Server permission-code matrix for a role (read-only).
 * Shape: { roleId, roleLabel, permissions: { code: grantedBool }, modules: [] }
 */
export async function getRolePermissions(roleId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(
    `/api/v1/admin/roles/${encodeURIComponent(roleId)}/permissions`,
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  const payload = res.data || {}
  const list = Array.isArray(payload.permissions) ? payload.permissions : []
  const permissions = Object.fromEntries(
    list.map((row) => [row.code, Boolean(row.granted)]),
  )
  return {
    ...res,
    data: {
      roleId: payload.id || roleId,
      roleLabel: payload.label || roleId,
      permissions,
      permissionRows: list,
      modules: [],
      writeSupported: false,
    },
  }
}

/**
 * Intentionally fail-closed: production FastAPI exposes no PATCH for role
 * permission matrices. Kept so callers cannot invent a local success path.
 */
export async function patchRolePermissions(roleId, _permissions, _options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return {
    success: false,
    error: `Permission matrix write is not available. GET /api/v1/admin/roles/${roleId}/permissions is read-only; no PATCH contract is mounted.`,
    data: null,
  }
}
