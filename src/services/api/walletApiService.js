/**
 * Live school wallet ledger API — campus finance snapshot on PostgreSQL.
 * Online gateway recharge is not connected; recharge is offline (cash / cheque / bank transfer) only.
 */

import { apiClient } from './apiClient.js'
import { isLiveApiEnabled } from './tokenStore.js'

const BASE = '/api/v1/finance/actions'

export const EMPTY_WALLET_DATA = {
  wallets: [],
  recharges: [],
  spends: [],
  summary: null,
  rechargeMethods: [],
}

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

async function post(path, payload, fallback) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(`${BASE}/${path}`, payload, { skipMock: true })
  if (!res.success) return { ...res, error: detailMessage(res, fallback) }
  return res
}

const arr = (v) => (Array.isArray(v) ? v : [])

export async function listWalletsApi() {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: EMPTY_WALLET_DATA }
  const res = await apiClient.get(`${BASE}/wallets`, { skipMock: true })
  if (!res.success) return { ...res, error: detailMessage(res, 'Could not load wallets.'), data: EMPTY_WALLET_DATA }
  const body = res.data && typeof res.data === 'object' ? res.data : {}
  return {
    ...res,
    data: {
      wallets: arr(body.wallets),
      recharges: arr(body.recharges),
      spends: arr(body.spends),
      summary: body.summary || null,
      rechargeMethods: arr(body.rechargeMethods),
    },
  }
}

export const openWalletApi = (payload) => post('open-wallet', payload, 'Could not open wallet.')
export const rechargeWalletApi = (payload) => post('recharge-wallet', payload, 'Wallet recharge failed.')
export const spendWalletApi = (payload) => post('spend-wallet', payload, 'Wallet spend failed.')
export const setWalletStatusApi = (payload) => post('set-wallet-status', payload, 'Could not update wallet status.')
