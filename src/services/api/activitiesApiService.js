/**
 * Live school activities (cultural / sports / competitions) — FastAPI /api/v1/activities*.
 * No mock fallback when live fails.
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

const BASE = '/api/v1/activities'

/** GET /api/v1/activities */
export async function listActivitiesApi(params = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get(BASE, { skipMock: true, params, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data : [] }
}

/** POST /api/v1/activities */
export async function createActivityApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post(BASE, body || {}, { skipMock: true, ...options })
}

/** PATCH /api/v1/activities/{ref} */
export async function patchActivityApi(ref, body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.patch(`${BASE}/${encodeURIComponent(ref)}`, body || {}, { skipMock: true, ...options })
}

/** DELETE /api/v1/activities/{ref} */
export async function deleteActivityApi(ref, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.delete(`${BASE}/${encodeURIComponent(ref)}`, { skipMock: true, ...options })
}

/** POST /api/v1/activities/{ref}/approval  — status: Pending | Approved | Rejected */
export async function decideActivityApprovalApi(ref, status, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post(`${BASE}/${encodeURIComponent(ref)}/approval`, { status }, { skipMock: true, ...options })
}
