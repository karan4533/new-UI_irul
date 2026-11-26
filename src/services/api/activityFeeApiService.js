/**
 * Live Activity Fee API — campus finance snapshot on PostgreSQL.
 * No localStorage; no mock fallback when live fails.
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

function detailMessage(res) {
  const detail = res?.error || res?.data?.detail || res?.message
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string') return detail.message
    if (typeof detail.detail === 'string') return detail.detail
  }
  return 'Activity fee request failed.'
}

/** GET /api/v1/finance/actions/activity-fees */
export async function listActivityFeesApi(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: { fees: [], assignments: [] } }
  const res = await apiClient.get('/api/v1/finance/actions/activity-fees', {
    skipMock: true,
    ...options,
  })
  if (!res.success) {
    return { ...res, error: detailMessage(res), data: { fees: [], assignments: [] } }
  }
  const body = res.data && typeof res.data === 'object' ? res.data : {}
  return {
    ...res,
    data: {
      fees: Array.isArray(body.fees) ? body.fees : [],
      assignments: Array.isArray(body.assignments) ? body.assignments : [],
      feeCount: body.feeCount ?? 0,
      assignmentCount: body.assignmentCount ?? 0,
    },
  }
}

/** POST /api/v1/finance/actions/upsert-activity-fee */
export async function upsertActivityFeeApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/finance/actions/upsert-activity-fee', body || {}, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return { ...res, error: detailMessage(res) }
  return res
}

/** POST /api/v1/finance/actions/assign-activity-fee */
export async function assignActivityFeeApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/finance/actions/assign-activity-fee', body || {}, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return { ...res, error: detailMessage(res) }
  return res
}

/** POST /api/v1/finance/actions/update-activity-attendance */
export async function updateActivityAttendanceApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/finance/actions/update-activity-attendance', body || {}, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return { ...res, error: detailMessage(res) }
  return res
}

/** POST /api/v1/finance/actions/collect-activity-fee */
export async function collectActivityFeeApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/finance/actions/collect-activity-fee', body || {}, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return { ...res, error: detailMessage(res) }
  return res
}
