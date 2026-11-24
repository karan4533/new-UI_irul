/**
 * Approval Engine C — FastAPI /api/v1/approvals/*
 * Used when VITE_USE_MOCK=false. No localStorage / seed fallback.
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

function formatEntityType(entityType = '') {
  const raw = String(entityType || '').trim()
  if (!raw) return 'Approval Request'
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatRequestDate(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function mapStatus(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'approved') return 'Approved'
  if (key === 'denied' || key === 'rejected') return 'Rejected'
  return 'Pending'
}

export function mapApprovalToUi(row = {}) {
  const entityType = row.entityType || row.entity_type || ''
  const entityId = row.entityId || row.entity_id || ''
  return {
    id: row.id || '',
    requestId: entityId || row.id || '',
    category: formatEntityType(entityType),
    requestDate: formatRequestDate(row.createdAt || row.created_at),
    requestedBy: row.initiatorRole || row.initiator_role || '—',
    role: row.initiatorRole || row.initiator_role || '',
    department: formatEntityType(entityType),
    title: row.title || `${formatEntityType(entityType)} ${entityId}`.trim(),
    amount: null,
    priority: 'Normal',
    status: mapStatus(row.status),
    requestedTo: row.awaitingRole || 'Current approver',
    description: `Workflow entity ${entityType || '—'} / ${entityId || '—'}`,
    entityType,
    entityId,
    awaitingRole: row.awaitingRole || null,
    chain: Array.isArray(row.chain) ? row.chain : [],
    events: Array.isArray(row.events) ? row.events : [],
    createdAt: row.createdAt || row.created_at || '',
    updatedAt: row.updatedAt || row.updated_at || '',
    superAdminRemarks: '',
    source: 'backend',
  }
}

export async function listApprovalInbox(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/approvals/inbox', { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  return {
    ...res,
    data: Array.isArray(res.data) ? res.data.map(mapApprovalToUi) : [],
  }
}

export async function getApprovalDetail(approvalId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  if (!approvalId) {
    return { success: false, error: 'Approval id is required.', data: null }
  }
  const res = await apiClient.get(`/api/v1/approvals/${approvalId}`, { skipMock: true, ...options })
  if (!res.success) return { ...res, data: null }
  return { ...res, data: mapApprovalToUi(res.data || {}) }
}

export async function decideApproval(approvalId, { decision, comment } = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  if (!approvalId) {
    return { success: false, error: 'Approval id is required.', data: null }
  }
  // Backend approvals.decide() accepts only "approve" | "deny" (not approved/denied).
  const raw = String(decision || '').trim().toLowerCase()
  const apiDecision = ['deny', 'denied', 'reject', 'rejected'].includes(raw)
    ? 'deny'
    : ['approve', 'approved'].includes(raw)
      ? 'approve'
      : null
  if (!apiDecision) {
    return {
      success: false,
      error: "decision must be 'approve' or 'deny'.",
      data: null,
    }
  }
  const res = await apiClient.post(
    `/api/v1/approvals/${approvalId}/decide`,
    { decision: apiDecision, comment: comment || null },
    { skipMock: true, ...options },
  )
  if (!res.success) return { ...res, data: null }
  return { ...res, data: mapApprovalToUi(res.data || {}) }
}
