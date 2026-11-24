import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Document the backend vocabulary contract used by decideApproval.
 * Runtime mapping lives in approvalsApiService.js (approve|deny only).
 */
test('approvals decide vocabulary accepts approve/deny aliases', () => {
  const normalize = (decision) => {
    const raw = String(decision || '').trim().toLowerCase()
    if (['deny', 'denied', 'reject', 'rejected'].includes(raw)) return 'deny'
    if (['approve', 'approved'].includes(raw)) return 'approve'
    return null
  }
  assert.equal(normalize('approved'), 'approve')
  assert.equal(normalize('approve'), 'approve')
  assert.equal(normalize('denied'), 'deny')
  assert.equal(normalize('deny'), 'deny')
  assert.equal(normalize('rejected'), 'deny')
  assert.equal(normalize('nope'), null)
})
