/**
 * Live accounting API — chart of accounts, journal vouchers, bank reconciliation, financial statements.
 * Campus finance snapshot on PostgreSQL via /api/v1/finance/actions/*.
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

async function getJson(path, fallback, empty, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: empty }
  const res = await apiClient.get(`${BASE}/${path}`, { skipMock: true, ...options })
  if (!res.success) return { ...res, error: detailMessage(res, fallback), data: empty }
  return { ...res, data: res.data && typeof res.data === 'object' ? res.data : empty }
}

async function postJson(path, payload, fallback) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(`${BASE}/${path}`, payload, { skipMock: true })
  if (!res.success) return { ...res, error: detailMessage(res, fallback) }
  return res
}

const arr = (v) => (Array.isArray(v) ? v : [])

export async function listChartOfAccountsApi() {
  const res = await getJson('chart-of-accounts', 'Could not load chart of accounts.', { accounts: [] })
  return { ...res, data: { ...res.data, accounts: arr(res.data?.accounts) } }
}

export const upsertAccountApi = (payload) => postJson('upsert-account', payload, 'Could not save account.')

export async function listJournalVouchersApi() {
  const res = await getJson('journal-vouchers', 'Could not load journal vouchers.', { vouchers: [] })
  return { ...res, data: { ...res.data, vouchers: arr(res.data?.vouchers) } }
}

export const createJournalVoucherApi = (payload) =>
  postJson('create-journal-voucher', payload, 'Could not create journal voucher.')

export const postJournalVoucherApi = (voucherId) =>
  postJson('post-journal-voucher', { voucherId }, 'Could not post journal voucher.')

export async function listBankReconciliationApi() {
  const res = await getJson('bank-reconciliation', 'Could not load bank reconciliation.', { items: [] })
  return { ...res, data: { ...res.data, items: arr(res.data?.items) } }
}

export const reconcileBankEntryApi = (payload) =>
  postJson('reconcile-bank-entry', payload, 'Could not reconcile bank entry.')

export async function getFinancialStatementsApi({ dateFrom, dateTo, department } = {}) {
  const params = {}
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo
  if (department && department !== 'All Departments') params.department = department
  return getJson('financial-statements', 'Could not generate financial statements.', null, { params })
}
