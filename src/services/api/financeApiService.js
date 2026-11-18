/**
 * Live Finance API — FastAPI /api/v1/finance/*
 * Snapshot hydrate + authoritative actions. No mock fallback when live fails.
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

function normalizeStatePayload(raw) {
  const body = raw && typeof raw === 'object' ? raw : {}
  const data = body.data && typeof body.data === 'object' ? body.data : {}
  return {
    data,
    savedAt: body.savedAt || null,
    seeded: Boolean(body.seeded ?? data?.meta?.seeded),
  }
}

/** GET /api/v1/finance/state */
export async function getFinanceState(options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get('/api/v1/finance/state', { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: normalizeStatePayload(res.data) }
}

/** PUT /api/v1/finance/state — full campus snapshot replace. */
export async function saveFinanceStateApi(data, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.put(
    '/api/v1/finance/state',
    { data: data && typeof data === 'object' ? data : {} },
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: normalizeStatePayload(res.data) }
}

/** POST /api/v1/finance/state/reset */
export async function resetFinanceStateApi(options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/finance/state/reset', {}, { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: normalizeStatePayload(res.data) }
}

/** GET /api/v1/finance/{collection} */
export async function listFinanceCollection(collection, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get(`/api/v1/finance/${encodeURIComponent(collection)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data : [] }
}

/** POST /api/v1/finance/actions/collect-payment */
export async function collectPaymentApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/finance/actions/collect-payment', body || {}, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: res.data && typeof res.data === 'object' ? res.data : null }
}

/** POST /api/v1/finance/actions/settle-cheque */
export async function settleChequeApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post('/api/v1/finance/actions/settle-cheque', body || {}, { skipMock: true, ...options })
}

/** POST /api/v1/finance/actions/send-receipt */
export async function sendReceiptApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post('/api/v1/finance/actions/send-receipt', body || {}, { skipMock: true, ...options })
}

/** POST /api/v1/finance/actions/decide-approval */
export async function decideFinanceApprovalApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post('/api/v1/finance/actions/decide-approval', body || {}, { skipMock: true, ...options })
}

/** POST /api/v1/finance/actions/apply-hr-concessions */
export async function applyHrConcessionsApi(options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post('/api/v1/finance/actions/apply-hr-concessions', {}, { skipMock: true, ...options })
}

/** POST /api/v1/finance/actions/gateway-intent */
export async function createGatewayIntentApi(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post('/api/v1/finance/actions/gateway-intent', body || {}, { skipMock: true, ...options })
}
