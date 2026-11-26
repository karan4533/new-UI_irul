/**
 * Live payment voucher register + vendor liability payment — PostgreSQL via finance actions API.
 */

import { apiClient } from './apiClient.js'
import { isLiveApiEnabled } from './tokenStore.js'

const EMPTY = {
  fees: [],
  vendorLiabilities: [],
  vendorPayments: [],
  payroll: [],
  payrollReversals: [],
  counts: { fees: 0, vendorLiabilities: 0, vendorOpen: 0, vendorPayments: 0, payroll: 0, payrollReversals: 0, total: 0 },
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

export async function listPaymentVouchersApi(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: EMPTY }
  const res = await apiClient.get('/api/v1/finance/actions/payment-vouchers', { skipMock: true, ...options })
  if (!res.success) {
    return { ...res, error: detailMessage(res, 'Could not load payment vouchers.'), data: EMPTY }
  }
  const body = res.data && typeof res.data === 'object' ? res.data : {}
  const arr = (v) => (Array.isArray(v) ? v : [])
  return {
    ...res,
    data: {
      fees: arr(body.fees),
      vendorLiabilities: arr(body.vendorLiabilities),
      vendorPayments: arr(body.vendorPayments),
      payroll: arr(body.payroll),
      payrollReversals: arr(body.payrollReversals),
      counts: { ...EMPTY.counts, ...(body.counts || {}) },
    },
  }
}

export async function payVendorLiabilityApi(payload) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/finance/actions/pay-vendor-liability', payload, { skipMock: true })
  if (!res.success) {
    return { ...res, error: detailMessage(res, 'Vendor payment failed.') }
  }
  return res
}
