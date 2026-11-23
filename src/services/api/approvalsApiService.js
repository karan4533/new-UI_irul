/**
 * Campus approvals inbox — FastAPI /api/v1/approvals*
 * No mock fallback when live fails.
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

function titleCaseStatus(status) {
  const raw = String(status || 'pending').toLowerCase()
  if (raw === 'approved' || raw === 'approve') return 'Approved'
  if (raw === 'denied' || raw === 'rejected' || raw === 'deny') return 'Rejected'
  if (raw === 'pending') return 'Pending'
  return status || 'Pending'
}

export function mapApprovalToUi(row = {}) {
  const status = titleCaseStatus(row.status)
  const created = row.createdAt || row.created_at || ''
  return {
    id: row.id || '',
    requestId: row.id || '',
    entityType: row.entityType || '',
    entityId: row.entityId || '',
    title: row.title || `${row.entityType || 'Request'} · ${row.entityId || ''}`.trim(),
    category: row.entityType || 'Approval',
    requestDate: created ? String(created).slice(0, 10) : '',
    requestedBy: row.initiatorRole || 'Staff',
    role: row.initiatorRole || '',
    department: row.awaitingRole || '',
    amount: null,
    priority: status === 'Pending' ? 'Normal' : 'Low',
    status,
    awaitingRole: row.awaitingRole || null,
    currentLevel: row.currentLevel ?? null,
    chain: Array.isArray(row.chain) ? row.chain : [],
    events: Array.isArray(row.events) ? row.events : [],
    description: row.title || '',
    superAdminRemarks: '',
    createdAt: created,
    updatedAt: row.updatedAt || null,
    source: 'backend',
  }
}

export async function listApprovalsInbox(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/approvals/inbox', { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  return {
    ...res,
    data: Array.isArray(res.data) ? res.data.map(mapApprovalToUi) : [],
  }
}

export async function getApproval(approvalId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/approvals/${encodeURIComponent(approvalId)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapApprovalToUi(res.data || {}) }
}

export async function decideApproval(approvalId, { decision, comment = null } = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const normalized =
    String(decision || '').toLowerCase() === 'approved' || String(decision || '').toLowerCase() === 'approve'
      ? 'approve'
      : 'deny'
  const res = await apiClient.post(
    `/api/v1/approvals/${encodeURIComponent(approvalId)}/decide`,
    { decision: normalized, comment },
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapApprovalToUi(res.data || {}) }
}
