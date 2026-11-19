/**
 * Live TC requests — FastAPI /api/v1/tc-requests*
 * Admin decides (tc.decide). No mock fallback when live fails.
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

export function mapTcRequestToUi(row = {}) {
  return {
    id: row.id || row.requestId || '',
    requestId: row.requestId || row.id || '',
    uuid: row.uuid || '',
    studentId: row.studentId || '',
    studentName: row.studentName || '',
    classSection: row.classSection || '',
    admissionNumber: row.admissionNumber || '',
    reason: row.reason || '',
    transferTo: row.transferTo || '',
    lastDateOfAttendance: row.lastDateOfAttendance || '',
    requestedBy: row.requestedBy || '',
    requestedOn: row.requestedOn || '',
    status: row.status || '',
    prmRemarks: row.prmRemarks || '',
    superAdminRemarks: row.superAdminRemarks || '',
    forwardedOn: row.forwardedOn || '',
    approvedOn: row.approvedOn || '',
    rejectedOn: row.rejectedOn || '',
    tcNumber: row.tcNumber || '',
    tcIssuedDate: row.tcIssuedDate || '',
    tcDocumentName: row.tcDocumentName || '',
    nocClearances: row.nocClearances || [],
    dataSource: 'backend',
  }
}

export async function listTcRequests(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/tc-requests', { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: Array.isArray(res.data) ? res.data.map(mapTcRequestToUi) : [] }
}

export async function getTcRequest(ref, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/tc-requests/${encodeURIComponent(ref)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapTcRequestToUi(res.data || {}) }
}

export async function decideTcRequest(ref, { decision, remarks = '' } = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(
    `/api/v1/tc-requests/${encodeURIComponent(ref)}/decide`,
    { decision, remarks },
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapTcRequestToUi(res.data || {}) }
}

/** POST /api/v1/tc-requests/{ref}/forward — PRM / admin (tc.write) */
export async function forwardTcRequest(ref, remarks = '', options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(
    `/api/v1/tc-requests/${encodeURIComponent(ref)}/forward`,
    { remarks },
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapTcRequestToUi(res.data || {}) }
}

/** POST /api/v1/tc-requests/{ref}/reject-prm — PRM review reject */
export async function rejectTcRequestAtPrm(ref, remarks = '', options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(
    `/api/v1/tc-requests/${encodeURIComponent(ref)}/reject-prm`,
    { remarks },
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapTcRequestToUi(res.data || {}) }
}
