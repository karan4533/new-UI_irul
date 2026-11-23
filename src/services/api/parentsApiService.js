/**
 * Parent contacts for staff — FastAPI GET /api/v1/parents
 */

import { apiClient } from './apiClient.js'
import { isLiveApiEnabled } from './tokenStore.js'
import mo_user from '../../assets/images/no-profile.png'

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

export function mapParentToUi(row = {}) {
  return {
    id: String(row.id || row.studentId || ''),
    parentId: String(row.id || row.studentId || ''),
    profileImage: mo_user,
    parentName: row.parentName || '—',
    gender: row.gender || '—',
    email: row.parentEmail || row.email || '—',
    mobileNumber: row.mobileNumber || row.parentMobile || '—',
    studentName: row.studentName || '—',
    admissionNumber: row.admissionNumber || '—',
    relation: row.relation || 'Parent',
    className: row.className || '',
    section: row.section || '',
    source: 'backend',
  }
}

export async function listParents(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/parents', { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  const rows = Array.isArray(res.data) ? res.data.map(mapParentToUi) : []
  return { ...res, data: rows }
}
