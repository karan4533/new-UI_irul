/**
 * Academic calendar API — FastAPI /api/v1/calendar*
 * Used when VITE_USE_MOCK=false. No fake success without backend confirmation.
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
    uuid: row.uuid || null,
    type: row.type || 'event',
    title: row.title || '',
    startDate: row.startDate || '',
    endDate: row.endDate || row.startDate || '',
    allDay: row.allDay !== false && !row.startTime,
    startTime: row.allDay === false ? row.startTime || null : null,
    endTime: row.allDay === false ? row.endTime || null : null,
    description: row.description || '',
    source: 'backend',
    raw: row,
  }
}

export async function listCalendarEvents(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/calendar', { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  const rows = Array.isArray(res.data) ? res.data : []
  return { ...res, data: rows.map(mapCalendarEventToUi) }
}

export async function createCalendarEvent(payload = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const body = {
    type: payload.type || 'event',
    title: payload.title,
    startDate: payload.startDate,
    endDate: payload.endDate || payload.startDate,
    description: payload.description || '',
    allDay: payload.allDay !== false,
    startTime: payload.allDay === false ? payload.startTime || null : null,
    endTime: payload.allDay === false ? payload.endTime || null : null,
  }
  const res = await apiClient.post('/api/v1/calendar', body, { skipMock: true, ...options })
  if (!res.success) return { ...res, data: null }
  return { ...res, data: mapCalendarEventToUi(res.data || {}) }
}
