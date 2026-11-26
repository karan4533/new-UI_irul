/**
 * Live finance concessions API — campus finance snapshot on PostgreSQL.
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
  return 'Concession request failed.'
}

export async function listConcessionsApi(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: { concessions: [] } }
  const res = await apiClient.get('/api/v1/finance/actions/concessions', {
    skipMock: true,
    ...options,
  })
  if (!res.success) {
    return { ...res, error: detailMessage(res), data: { concessions: [] } }
  }
  const body = res.data && typeof res.data === 'object' ? res.data : {}
  return {
    ...res,
    data: {
      concessions: Array.isArray(body.concessions) ? body.concessions : [],
      concessionCount: body.concessionCount ?? 0,
    },
  }
}

export async function createConcessionApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/finance/actions/create-concession', body || {}, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return { ...res, error: detailMessage(res) }
  return res
}
