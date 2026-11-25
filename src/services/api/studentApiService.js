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

/** GET /api/v1/students/me — linked student profile for student portal login. */
export async function getMyStudent(options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get('/api/v1/students/me', { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: mapStudentToUi(res.data || {}) }
}

/**
 * GET /api/v1/parents/me/children — enrolled children for signed-in parent.
 * API SoT for Select Child (replaces FE seed mapping when live).
 */
export async function listMyChildren(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/parents/me/children', { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  const rows = Array.isArray(res.data) ? res.data.map(mapStudentToUi) : []
  return { ...res, data: rows }
}

/** GET /api/v1/students/pending-placement — students.place */
export async function listPendingPlacement(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/students/pending-placement', {
    skipMock: true,
    ...options,
  })
  if (!res.success) return { ...res, data: [] }
  const rows = Array.isArray(res.data) ? res.data.map(mapStudentToUi) : []
  return { ...res, data: rows }
}

/** GET /api/v1/students/my-grade-band — students.place */
export async function getMyGradeBand(options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.get('/api/v1/students/my-grade-band', { skipMock: true, ...options })
}

/** GET /api/v1/students/placement-options?className= — students.place */
export async function getPlacementOptions(className, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: null }
  const query = {}
  if (className) query.className = className
  return apiClient.get('/api/v1/students/placement-options', {
    skipMock: true,
    params: query,
    ...options,
  })
}

/** POST /api/v1/students/{id}/place — students.place */
export async function placeStudent(studentId, sectionId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post(
    `/api/v1/students/${encodeURIComponent(studentId)}/place`,
    { sectionId },
    { skipMock: true, ...options },
  )
}

/** GET /api/v1/students/placed — students.promote */
export async function listPlacedForBand(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/students/placed', { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  const rows = Array.isArray(res.data) ? res.data.map(mapStudentToUi) : []
  return { ...res, data: rows }
}

/** GET /api/v1/students/promote-options/{id} — students.promote */
export async function getPromoteOptions(studentId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.get(`/api/v1/students/promote-options/${encodeURIComponent(studentId)}`, {
    skipMock: true,
    ...options,
  })
}

/** POST /api/v1/students/{id}/promote — students.promote */
export async function promoteStudent(studentId, body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post(
    `/api/v1/students/${encodeURIComponent(studentId)}/promote`,
    body || {},
    { skipMock: true, ...options },
  )
}
