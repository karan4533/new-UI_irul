/**
 * Live Transport Fee API — campus finance snapshot on PostgreSQL.
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
  return 'Transport fee request failed.'
}

export async function listTransportFeesApi(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: { fees: [], assignments: [] } }
  const res = await apiClient.get('/api/v1/finance/actions/transport-fees', {
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

export async function upsertTransportFeeApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/finance/actions/upsert-transport-fee', body || {}, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return { ...res, error: detailMessage(res) }
  return res
}

export async function assignTransportFeeApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/finance/actions/assign-transport-fee', body || {}, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return { ...res, error: detailMessage(res) }
  return res
}

export async function collectTransportFeeApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/finance/actions/collect-transport-fee', body || {}, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return { ...res, error: detailMessage(res) }
  return res
}
