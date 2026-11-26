/**
 * Live finance extras — book fee breakup, annual budget vs GL actuals, report pack, FY / tax settings.
 * All read from / write to the campus finance snapshot on PostgreSQL through /api/v1/finance/actions.
 */

import { apiClient } from './apiClient.js'
import { isLiveApiEnabled } from './tokenStore.js'

const BASE = '/api/v1/finance/actions'

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

function detailMessage(res, fallback) {
  const detail = res?.error || res?.data?.detail || res?.message
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string') return detail.message
    if (typeof detail.detail === 'string') return detail.detail
  }
  return fallback
}

async function get(path, params, fallback) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`${BASE}/${path}`, { params, skipMock: true })
  if (!res.success) return { ...res, error: detailMessage(res, fallback) }
  return { ...res, data: res.data && typeof res.data === 'object' ? res.data : {} }
}

async function post(path, payload, fallback) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(`${BASE}/${path}`, payload, { skipMock: true })
  if (!res.success) return { ...res, error: detailMessage(res, fallback) }
  return res
}

export const listBookFeesApi = () => get('book-fees', undefined, 'Could not load book fees.')
export const upsertBookFeeApi = (payload) => post('upsert-book-fee', payload, 'Could not save book fee line.')
export const deleteBookFeeApi = (id) => post('delete-book-fee', { id }, 'Could not delete book fee line.')

export const listBudgetApi = (financialYear) =>
  get('annual-budget', financialYear ? { financialYear } : undefined, 'Could not load the annual budget.')
export const upsertBudgetLineApi = (payload) => post('upsert-budget-line', payload, 'Could not save budget line.')

export const getReportPackApi = (financialYear) =>
  get('report-pack', financialYear ? { financialYear } : undefined, 'Could not load finance reports.')

export const getFinanceSettingsApi = () => get('finance-settings', undefined, 'Could not load finance settings.')
export const updateFinanceSettingsApi = (payload) =>
  post('update-finance-settings', payload, 'Could not save finance settings.')
