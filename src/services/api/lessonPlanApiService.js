/**
 * Live lesson plans — FastAPI /api/v1/lesson-plans*
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

export async function listLessonPlans(params = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const query = {}
  if (params.mine) query.mine = true
  const res = await apiClient.get('/api/v1/lesson-plans', { skipMock: true, params: query, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data : [] }
}

export async function createLessonPlan(body, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post('/api/v1/lesson-plans', body || {}, { skipMock: true, ...options })
}
