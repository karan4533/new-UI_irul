/**
 * Client Finance rule: Finance sets per-role spend/approval limits.
 * Live mode reads/writes PostgreSQL via /api/v1/finance/approval-limits.
 */

import { apiClient } from '../../services/api/apiClient.js'
import { isLiveApiEnabled } from '../../services/api/tokenStore.js'

const STORAGE_KEY = 'qmis-finance-approval-limits'

export const DEFAULT_APPROVAL_LIMITS = Object.freeze([
  { role: 'teacher', label: 'Teacher', limitInr: 5000 },
  { role: 'coordinator', label: 'Coordinator', limitInr: 15000 },
  { role: 'principal', label: 'Principal', limitInr: 50000 },
  { role: 'director', label: 'Director / DA', limitInr: 100000 },
  { role: 'jointdirector', label: 'Joint Director', limitInr: 200000 },
  { role: 'store', label: 'Store Officer', limitInr: 25000 },
  { role: 'accounthead', label: 'Account Head', limitInr: 500000 },
])

function normalizeRole(role = '') {
  return String(role || '')
    .toLowerCase()
    .replace(/[-_\s]/g, '')
}

export function loadApprovalLimits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_APPROVAL_LIMITS]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) return [...DEFAULT_APPROVAL_LIMITS]
    return parsed.map((row) => ({
      role: normalizeRole(row.role || row.roleCode),
      label: row.label || row.role,
      limitInr: Number(row.limitInr ?? row.limit ?? 0) || 0,
      category: row.category || 'general',
    }))
  } catch {
    return [...DEFAULT_APPROVAL_LIMITS]
  }
}

export function saveApprovalLimitsLocal(limits = []) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(limits))
}

export async function fetchApprovalLimitsApi() {
  if (!isLiveApiEnabled()) {
    return { success: true, data: loadApprovalLimits(), live: false }
  }
  const res = await apiClient.get('/api/v1/finance/approval-limits', { skipMock: true })
  if (!res.success) return { ...res, data: loadApprovalLimits(), live: true }
  const rows = res.data?.limits || res.data?.data?.limits || []
  const mapped = (Array.isArray(rows) ? rows : []).map((row) => ({
    role: normalizeRole(row.role || row.roleCode),
    label: row.label || row.role,
    limitInr: Number(row.limitInr ?? row.limit ?? 0) || 0,
    category: row.category || 'general',
  }))
  if (mapped.length) saveApprovalLimitsLocal(mapped)
  return { success: true, data: mapped.length ? mapped : loadApprovalLimits(), live: true }
}

export async function saveApprovalLimitsApi(limits = []) {
  if (!isLiveApiEnabled()) {
    saveApprovalLimitsLocal(limits)
    return { success: true, data: limits, live: false }
  }
  const res = await apiClient.put(
    '/api/v1/finance/approval-limits',
    {
      limits: limits.map((row) => ({
        role: row.role,
        label: row.label,
        limitInr: Number(row.limitInr) || 0,
        category: row.category || 'general',
      })),
    },
    { skipMock: true },
  )
  if (!res.success) return res
  const rows = res.data?.limits || []
  const mapped = rows.map((row) => ({
    role: normalizeRole(row.role || row.roleCode),
    label: row.label || row.role,
    limitInr: Number(row.limitInr ?? 0) || 0,
    category: row.category || 'general',
  }))
  saveApprovalLimitsLocal(mapped.length ? mapped : limits)
  return { success: true, data: mapped.length ? mapped : limits, live: true }
}

export async function evaluateSpendAgainstLimitApi({ amountInr, actorRole, category = 'general' } = {}) {
  if (!isLiveApiEnabled()) {
    return evaluateSpendAgainstLimit({ amountInr, actorRole })
  }
  const res = await apiClient.post(
    '/api/v1/finance/approval-limits/evaluate',
    { amountInr, role: actorRole, category },
    { skipMock: true },
  )
  if (!res.success) {
    return evaluateSpendAgainstLimit({ amountInr, actorRole })
  }
  const body = res.data || {}
  return {
    withinLimit: Boolean(body.withinLimit),
    limitInr: body.limitInr ?? null,
    requiresFinance: Boolean(body.requiresFinance),
    message: body.message || '',
  }
}

export function getLimitForRole(role, limits = loadApprovalLimits()) {
  const key = normalizeRole(role)
  const aliases = {
    stationerystoremanager: 'store',
    housekeepingmanager: 'store',
    itsupportmanager: 'store',
    canteenmanager: 'store',
    jointdirectoroperations: 'jointdirector',
    jointdirectoraudit: 'jointdirector',
    managingdirector: 'director',
  }
  const lookup = aliases[key] || key
  const row = limits.find((item) => item.role === lookup)
  return row ? Number(row.limitInr) || 0 : null
}

/**
 * @returns {{ withinLimit: boolean, limitInr: number|null, requiresFinance: boolean, message: string }}
 */
export function evaluateSpendAgainstLimit({ amountInr, actorRole, limits } = {}) {
  const amount = Number(amountInr) || 0
  const limit = getLimitForRole(actorRole, limits || loadApprovalLimits())
  if (limit == null) {
    return {
      withinLimit: false,
      limitInr: null,
      requiresFinance: true,
      message: 'No Finance approval limit configured for this role — route via Finance.',
    }
  }
  if (amount <= limit) {
    return {
      withinLimit: true,
      limitInr: limit,
      requiresFinance: false,
      message: `Within ₹${limit.toLocaleString('en-IN')} role limit.`,
    }
  }
  return {
    withinLimit: false,
    limitInr: limit,
    requiresFinance: true,
    message: `₹${amount.toLocaleString('en-IN')} exceeds ₹${limit.toLocaleString('en-IN')} limit — escalate to Finance via department head.`,
  }
}
