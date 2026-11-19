/**
 * Front Office / PRM campus records — FastAPI /api/v1/front-office/{collection}
 * Collections: student-gate-passes, hostel-gate-passes, material-gate-passes,
 * goods-received-passes, student-transfers, student-re-enrollments.
 */

import { apiClient } from './apiClient.js'
import { isLiveApiEnabled } from './tokenStore.js'

export const FRONT_OFFICE_COLLECTIONS = [
  'student-gate-passes',
  'hostel-gate-passes',
  'material-gate-passes',
  'goods-received-passes',
  'student-transfers',
  'student-re-enrollments',
]

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

export async function listFrontOfficeCollection(collection, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get(`/api/v1/front-office/${encodeURIComponent(collection)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data : [] }
}

export async function getFrontOfficeRecord(collection, publicId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.get(
    `/api/v1/front-office/${encodeURIComponent(collection)}/${encodeURIComponent(publicId)}`,
    { skipMock: true, ...options },
  )
}

export async function createFrontOfficeRecord(collection, body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post(`/api/v1/front-office/${encodeURIComponent(collection)}`, body || {}, {
    skipMock: true,
    ...options,
  })
}

export async function updateFrontOfficeRecord(collection, publicId, body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.put(
    `/api/v1/front-office/${encodeURIComponent(collection)}/${encodeURIComponent(publicId)}`,
    body || {},
    { skipMock: true, ...options },
  )
}

export async function deleteFrontOfficeRecord(collection, publicId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.delete(
    `/api/v1/front-office/${encodeURIComponent(collection)}/${encodeURIComponent(publicId)}`,
    { skipMock: true, ...options },
  )
}
