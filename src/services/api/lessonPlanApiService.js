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

export async function getLessonPlan(planId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.get(`/api/v1/lesson-plans/${encodeURIComponent(planId)}`, { skipMock: true, ...options })
}

export async function patchLessonPlan(planId, body = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.patch(`/api/v1/lesson-plans/${encodeURIComponent(planId)}`, body || {}, {
    skipMock: true,
    ...options,
  })
}

export async function submitLessonPlan(planId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post(`/api/v1/lesson-plans/${encodeURIComponent(planId)}/submit`, {}, {
    skipMock: true,
    ...options,
  })
}

export async function completeLessonPlan(planId, remarks = '', options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post(
    `/api/v1/lesson-plans/${encodeURIComponent(planId)}/complete`,
    { remarks },
    { skipMock: true, ...options },
  )
}

export async function reviseLessonPlan(planId, body = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post(`/api/v1/lesson-plans/${encodeURIComponent(planId)}/revise`, body || {}, {
    skipMock: true,
    ...options,
  })
}

/** Map API lesson plan row into the UI lesson-plan group shape used by LessonPlanWorkspace. */
export function mapLessonPlanToUi(row = {}) {
  const content = row.content && typeof row.content === 'object' ? row.content : {}
  return {
    id: row.id,
    planId: row.planId || row.id,
    subject: row.subject || content.subject || '',
    className: row.className || '',
    section: row.section || '',
    month: row.month || '',
    title: row.title || content.chapterName || row.subject || 'Lesson plan',
    approvalStatus: row.status === 'Submitted' || row.status === 'Pending'
      ? 'Pending'
      : row.status === 'Completed' || row.status === 'Approved'
        ? 'Approved'
        : row.status || 'Draft',
    markAsDone: row.status === 'Completed',
    submitterName: row.submitterName || row.teacherName || '',
    submitterRole: row.submitterRole || 'teacher',
    fromDate: content.fromDate || '',
    toDate: content.toDate || '',
    academicYear: content.academicYear || '',
    weekNo: content.weekNo || '',
    planningRows: content.planningRows || [],
    dataSource: 'backend',
    raw: row,
  }
}
