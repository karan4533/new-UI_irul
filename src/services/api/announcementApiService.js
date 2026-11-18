/**
 * Live Announcements API — FastAPI /api/v1/announcements
 * Used only when VITE_USE_MOCK=false. No mock/localStorage fallback here.
 */

import { apiClient } from './apiClient.js'
import { isLiveApiEnabled } from './tokenStore.js'

/** Backend-enforced categories (must match app.services.announcements.CATEGORIES). */
export const BACKEND_ANNOUNCEMENT_CATEGORIES = Object.freeze([
  'Administrative Notice',
  'Staff Notice',
  'Examination',
  'General Announcement',
  'Emergency',
  'Policy Update',
  'Holiday Announcement',
  'Training Announcement',
  'Internal Job Opening',
  'HR Circular',
])

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

export function mapApiAnnouncement(item = {}) {
  return {
    id: item.id || item.ref || item.code,
    uuid: item.uuid || null,
    title: item.title || '',
    message: item.message || item.body || '',
    category: item.category || 'General Announcement',
    announcementDate: item.announcementDate || item.published_at || item.createdAt || '',
    sentBy: item.sentBy || item.created_by_name || 'System',
    senderRole: item.senderRole || '',
    attachmentName: item.attachmentName || '',
    attachmentUrl: item.attachmentUrl || '',
    acknowledged: Boolean(item.acknowledged),
    acknowledgedAt: item.acknowledgedAt || null,
    createdAt: item.createdAt || item.announcementDate || '',
    replies: Array.isArray(item.replies) ? item.replies : [],
    audienceLabel: 'School broadcast audience (server-defined)',
    priority: item.priority || 'Normal',
    requireAcknowledgement: item.requireAcknowledgement !== false,
    source: 'backend',
  }
}

export async function listAnnouncements(options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get('/api/v1/announcements', { skipMock: true, ...options })
  if (!res.success) return res
  const rows = Array.isArray(res.data) ? res.data.map(mapApiAnnouncement) : []
  return { ...res, data: rows }
}

export async function getAnnouncement(ref, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/announcements/${encodeURIComponent(ref)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapApiAnnouncement(res.data || {}) }
}

export async function listAnnouncementCategories(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [...BACKEND_ANNOUNCEMENT_CATEGORIES] }
  const res = await apiClient.get('/api/v1/announcements/categories', { skipMock: true, ...options })
  if (!res.success) {
    return { ...res, data: [...BACKEND_ANNOUNCEMENT_CATEGORIES] }
  }
  const rows = Array.isArray(res.data) ? res.data : BACKEND_ANNOUNCEMENT_CATEGORIES
  return { ...res, data: rows }
}

/**
 * Create via multipart form (backend contract).
 * @param {{ title: string, category: string, message: string, announcementDate?: string, file?: File|null }} payload
 */
export async function createAnnouncement(payload, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked

  const form = new FormData()
  form.append('title', payload.title || '')
  form.append('category', payload.category || '')
  form.append('message', payload.message || '')
  if (payload.announcementDate) {
    form.append('announcement_date', payload.announcementDate)
  }
  if (payload.file instanceof File || payload.file instanceof Blob) {
    form.append('file', payload.file, payload.file.name || 'attachment')
  }

  const res = await apiClient.post('/api/v1/announcements', form, { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: mapApiAnnouncement(res.data || {}) }
}

export async function acknowledgeAnnouncement(ref, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post(
    `/api/v1/announcements/${encodeURIComponent(ref)}/acknowledge`,
    {},
    { skipMock: true, ...options }
  )
}

export async function replyToAnnouncement(ref, text, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(
    `/api/v1/announcements/${encodeURIComponent(ref)}/replies`,
    { text },
    { skipMock: true, ...options }
  )
  if (!res.success) return res
  // Backend may return updated announcement or reply stub — normalize if full object.
  if (res.data && (res.data.id || res.data.message)) {
    return { ...res, data: mapApiAnnouncement(res.data) }
  }
  return res
}
