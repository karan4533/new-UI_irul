/**
 * Live leave requests — FastAPI /api/v1/leave-requests*
 * Shared across roles with leave.read / leave.decide. No mock fallback when live fails.
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

export function mapLeaveRequestToUi(row = {}) {
  return {
    id: row.id,
    leaveRequestId: row.leaveRequestId || '',
    requestedBy: row.requestedBy || '',
    role: row.submitterRole || row.role || '',
    submitterRole: row.submitterRole || '',
    department: row.department || '',
    leaveType: row.leaveType || '',
    fromDate: row.fromDate || '',
    toDate: row.toDate || '',
    totalDays: row.totalDays ?? '',
    hours: row.hours ?? null,
    reason: row.reason || '',
    appliedDate: row.appliedDate || '',
    status: row.status || 'Pending',
    requestedTo: row.requestedTo || '',
    approverRole: row.approverRole || '',
    approverRemarks: row.approverRemarks || '',
    chain: row.chain || [],
    approvalId: row.approvalId || null,
    dataSource: 'backend',
  }
}

export async function listLeaveRequests(params = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const query = { box: params.box || 'mine' }
  if (params.status) query.status = params.status
  const res = await apiClient.get('/api/v1/leave-requests', { skipMock: true, params: query, ...options })
  if (!res.success) return res
  return { ...res, data: Array.isArray(res.data) ? res.data.map(mapLeaveRequestToUi) : [] }
}

export async function getLeaveRequest(requestId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/leave-requests/${encodeURIComponent(requestId)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapLeaveRequestToUi(res.data || {}) }
}

export async function createLeaveRequest(payload = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const body = {
    leaveType: payload.leaveType || payload.type || '',
    fromDate: payload.fromDate || '',
    toDate: payload.toDate || '',
    reason: payload.reason || '',
    totalDays: payload.totalDays ?? null,
    hours: payload.hours != null && payload.hours !== '' ? Number(payload.hours) : null,
    requestedTo: payload.requestedTo || null,
    department: payload.department || null,
  }
  const res = await apiClient.post('/api/v1/leave-requests', body, { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: mapLeaveRequestToUi(res.data || {}) }
}

export async function decideLeaveRequest(requestId, { decision, comment = null } = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(
    `/api/v1/leave-requests/${encodeURIComponent(requestId)}/decide`,
    { decision, comment },
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapLeaveRequestToUi(res.data || {}) }
}
