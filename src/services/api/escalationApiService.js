/**
 * Live escalations — FastAPI /api/v1/escalations*
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

function formatEscalationDate(isoOrDate) {
  if (!isoOrDate) return ''
  if (/^\d{2}-\d{2}-\d{4}$/.test(String(isoOrDate))) return String(isoOrDate)
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return String(isoOrDate)
  return d.toLocaleDateString('en-GB').replace(/\//g, '-')
}

export function mapEscalationToUi(row = {}) {
  const escalatedBy = row.escalatedBy || row.raisedBy || row.creatorName || ''
  const escalatedByRole =
    row.escalatedByRole || row.raisedByRole || row.escalatedByRoleKey || row.creatorRole || ''
  const recipientName =
    row.recipientName ||
    row.escalatedToUserName ||
    row.currentOwnerName ||
    row.escalatedToUserEmail ||
    ''
  const escalatedTo =
    row.escalatedTo || row.recipientRole || row.escalatedToRoleKey || recipientName || ''
  const createdAt = row.createdAt || row.escalatedAt || ''
  const status = row.status === 'Open' ? 'Pending' : row.status || 'Pending'
  return {
    id: row.id,
    escalationId: row.escalationId || row.id || '',
    description: row.description || '',
    fullDescription: row.fullDescription || row.description || '',
    remarks: row.remarks || '',
    resolutionRemarks: row.resolutionNote || row.resolutionRemarks || row.remarks || '',
    status,
    escalatedBy,
    escalatedByRole,
    escalatedByRoleKey: row.escalatedByRoleKey || '',
    raisedBy: escalatedBy,
    raisedByRole: escalatedByRole,
    escalatedTo,
    escalatedToRoleKey: row.escalatedToRoleKey || '',
    escalatedToUserId: row.escalatedToUserId || row.recipientUserId || row.currentOwnerId || null,
    escalatedToUserName: recipientName,
    escalatedToUserEmail: row.escalatedToUserEmail || '',
    recipientName,
    recipientRole: row.recipientRole || row.escalatedToRoleKey || '',
    recipientUserId: row.recipientUserId || row.escalatedToUserId || row.currentOwnerId || null,
    escalationDate: row.escalationDate || formatEscalationDate(createdAt),
    escalatedAt: row.escalatedAt || createdAt,
    createdAt,
    updatedAt: row.updatedAt || '',
    resolveBy: row.resolveBy || '',
    resolvedAt: row.resolvedAt || null,
    overdue: Boolean(row.overdue),
    history: row.history || row.trail || [],
    dataSource: 'backend',
  }
}

export async function listEscalations(params = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const query = { box: params.box || 'mine' }
  if (params.status) query.status = params.status
  const res = await apiClient.get('/api/v1/escalations', { skipMock: true, params: query, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data.map(mapEscalationToUi) : [] }
}

export async function getEscalation(escalationId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/escalations/${encodeURIComponent(escalationId)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapEscalationToUi(res.data || {}) }
}

export async function listEscalationRecipients(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/escalations/recipients', { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data : [] }
}

export async function createEscalation(body = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/escalations', body || {}, { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: mapEscalationToUi(res.data || {}) }
}

export async function setEscalationStatus(escalationId, { status, note = null } = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(
    `/api/v1/escalations/${encodeURIComponent(escalationId)}/status`,
    { status, note },
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapEscalationToUi(res.data || {}) }
}
