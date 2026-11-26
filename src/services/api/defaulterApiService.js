/**
 * Live unpaid installments / defaulters API — campus finance snapshot on PostgreSQL.
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
  return 'Defaulters request failed.'
}

export async function listUnpaidInstallmentsApi(options = {}) {
  const blocked = requireLive()
  if (blocked) {
    return {
      ...blocked,
      data: { installments: [], defaulters: [], defaulterCount: 0, totalOutstanding: 0, criticalCount: 0 },
    }
  }
  const res = await apiClient.get('/api/v1/finance/actions/unpaid-installments', {
    skipMock: true,
    ...options,
  })
  if (!res.success) {
    return {
      ...res,
      error: detailMessage(res),
      data: { installments: [], defaulters: [], defaulterCount: 0, totalOutstanding: 0, criticalCount: 0 },
    }
  }
  const body = res.data && typeof res.data === 'object' ? res.data : {}
  return {
    ...res,
    data: {
      installments: Array.isArray(body.installments) ? body.installments : [],
      defaulters: Array.isArray(body.defaulters) ? body.defaulters : [],
      installmentCount: body.installmentCount ?? 0,
      defaulterCount: body.defaulterCount ?? 0,
      totalOutstanding: body.totalOutstanding ?? 0,
      criticalCount: body.criticalCount ?? 0,
    },
  }
}
