/**
 * Academic calendar — FastAPI /api/v1/calendar
 * Live only. The backend list already merges approved/pending activities as `event` items.
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

export function mapCalendarEventToUi(row = {}) {
  return {
    id: row.id || row.uuid || '',
    uuid: row.uuid || '',
    type: row.type || 'event',
    title: row.title || '',
    startDate: row.startDate || '',
    endDate: row.endDate || row.startDate || '',
    description: row.description || '',
    source: 'backend',
  }
}

export async function listCalendarEvents(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/calendar', { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data.map(mapCalendarEventToUi) : [] }
}

export async function createCalendarEvent(payload, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const body = {
    type: payload.type,
    title: String(payload.title || '').trim(),
    startDate: payload.startDate,
    endDate: payload.endDate || payload.startDate,
    description: String(payload.description || '').trim(),
  }
  const res = await apiClient.post('/api/v1/calendar', body, { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: mapCalendarEventToUi(res.data || {}) }
}

export async function updateCalendarEvent(ref, patch, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.patch(`/api/v1/calendar/${encodeURIComponent(ref)}`, patch, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapCalendarEventToUi(res.data || {}) }
}

export async function deleteCalendarEvent(ref, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.delete(`/api/v1/calendar/${encodeURIComponent(ref)}`, { skipMock: true, ...options })
}
