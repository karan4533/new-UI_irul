/**
 * Client Finance rule: Finance sets per-role spend/approval limits.
 * Amounts above the role limit escalate to Finance via the department head.
 */

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
      role: normalizeRole(row.role),
      label: row.label || row.role,
      limitInr: Number(row.limitInr ?? row.limit ?? 0) || 0,
    }))
  } catch {
    return [...DEFAULT_APPROVAL_LIMITS]
  }
}

export function saveApprovalLimitsLocal(limits = []) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(limits))
}

export function getLimitForRole(role, limits = loadApprovalLimits()) {
  const key = normalizeRole(role)
  const aliases = {
    stationerystoremanager: 'store',
    housekeepingmanager: 'store',
    itsupportmanager: 'store',
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
