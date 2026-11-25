/**
 * Client Master Overview rule: no edit / no delete after save.
 * Corrections only via new dated actions.
 */

export const IMMUTABLE_STATUSES = Object.freeze([
  'Enrolled',
  'Approved',
  'Posted',
  'Issued',
  'Paid',
  'Exit Recorded',
  'Returned',
  'Rejected',
  'Cancelled',
  'Closed',
  'Verified',
  'Ready for Exit',
])

export function isRecordImmutable(record = {}, { statusKeys = ['status', 'finalStatus', 'displayStatus'] } = {}) {
  if (!record || typeof record !== 'object') return false
  if (record.immutable === true || record.locked === true || record.readOnly === true) return true
  for (const key of statusKeys) {
    const value = String(record[key] || '').trim()
    if (IMMUTABLE_STATUSES.includes(value)) return true
  }
  return false
}

export function assertCanEdit(record, label = 'Record') {
  if (isRecordImmutable(record)) {
    const err = new Error(`${label} is locked after save (client rule: no edit/delete). Create a new dated correction.`)
    err.code = 'immutable_record'
    throw err
  }
}

export function assertCanDelete(record, label = 'Record') {
  assertCanEdit(record, label)
}

export const IMMUTABLE_NOTICE =
  'Client rule: records cannot be edited or deleted after save. Use a new dated correction entry.'
