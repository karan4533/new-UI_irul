/**
 * Live academic fee structure API — campus finance snapshot on PostgreSQL.
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
  return 'Fee structure request failed.'
}

export async function listFeeStructuresApi(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: { structures: [], categories: [], fineRules: [] } }
  const res = await apiClient.get('/api/v1/finance/actions/fee-structures', {
    skipMock: true,
    ...options,
  })
  if (!res.success) {
    return { ...res, error: detailMessage(res), data: { structures: [], categories: [], fineRules: [] } }
  }
  const body = res.data && typeof res.data === 'object' ? res.data : {}
  return {
    ...res,
    data: {
      structures: Array.isArray(body.structures) ? body.structures : [],
      categories: Array.isArray(body.categories) ? body.categories : [],
      fineRules: Array.isArray(body.fineRules) ? body.fineRules : [],
      structureCount: body.structureCount ?? 0,
    },
  }
}

export async function upsertFeeStructureApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/finance/actions/upsert-fee-structure', body || {}, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return { ...res, error: detailMessage(res) }
  return res
}
