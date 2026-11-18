/**
 * Live students directory — FastAPI /api/v1/students
 * Shared across roles that have students.read. No mock fallback.
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

export function mapStudentToUi(row = {}) {
  return {
    id: row.id,
    name: row.name || '',
    admissionNumber: row.admissionNumber || '',
    className: row.className || '',
    section: row.section || '',
    classSection: row.classSection || `${row.className || ''}${row.section ? `-${row.section}` : ''}`,
    rollNumber: row.rollNumber ?? '',
    placementStatus: row.placementStatus || '',
    gender: row.gender || '',
    email: row.email || '',
    mobileNumber: row.mobileNumber || '',
    dateOfBirth: row.dateOfBirth || '',
    country: row.country || '',
    state: row.state || '',
    city: row.city || '',
    status: row.status || 'Active',
    grade: row.grade ?? null,
    source: 'backend',
  }
}

export async function listStudents(params = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const query = {}
  if (params.className) query.className = params.className
  const res = await apiClient.get('/api/v1/students', { skipMock: true, params: query, ...options })
  if (!res.success) return res
  const rows = Array.isArray(res.data) ? res.data.map(mapStudentToUi) : []
  return { ...res, data: rows }
}

export async function getStudent(studentId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/students/${encodeURIComponent(studentId)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapStudentToUi(res.data || {}) }
}
