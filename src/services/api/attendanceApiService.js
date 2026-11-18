/**
 * Live class attendance — FastAPI /api/v1/attendance*
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

export function mapAttendanceRowToUi(row = {}) {
  return {
    id: row.id || row.studentId,
    studentId: row.studentId,
    studentName: row.studentName || row.name || '—',
    admissionNumber: row.admissionNumber || '',
    className: row.className || '',
    section: row.section || '',
    attendanceStatus: row.attendanceStatus || row.status || 'Unmarked',
    inOutStatus: row.inOutStatus || '',
    date: row.date || '',
    dataSource: 'backend',
  }
}

/** GET /api/v1/attendance */
export async function listAttendance(params = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const query = {}
  if (params.date) query.date = params.date
  if (params.className) query.className = params.className
  if (params.section) query.section = params.section
  if (params.roster) query.roster = true
  const res = await apiClient.get('/api/v1/attendance', { skipMock: true, params: query, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data.map(mapAttendanceRowToUi) : [] }
}

/** POST /api/v1/attendance — upsert marks for a class/date */
export async function upsertAttendance(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/attendance', body || {}, { skipMock: true, ...options })
  if (!res.success) return res
  return {
    ...res,
    data: Array.isArray(res.data) ? res.data.map(mapAttendanceRowToUi) : [],
  }
}
