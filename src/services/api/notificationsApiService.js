/**
 * In-app notifications — FastAPI GET /api/v1/notifications
 * Mark read: POST /api/v1/notifications/{id}/read
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

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-')
}

function typeFromEntity(entityType = '') {
  const raw = String(entityType || '').toLowerCase()
  if (raw.includes('announc')) return 'Announcement'
  if (raw.includes('exam')) return 'Exam'
  if (raw.includes('event') || raw.includes('calendar')) return 'Event'
  if (raw.includes('holiday')) return 'Holiday'
  if (raw.includes('fee') || raw.includes('payment') || raw.includes('finance')) return 'Payment'
  if (raw.includes('leave')) return 'Leave'
  if (raw.includes('approv')) return 'Approval'
  if (raw.includes('escalat')) return 'Escalation'
  if (raw.includes('task')) return 'Task'
  if (raw.includes('ops') || raw.includes('ticket') || raw.includes('store')) return 'Ops'
  return 'General'
}

export function mapNotificationToUi(row = {}) {
  const type = typeFromEntity(row.entityType || row.type)
  return {
    id: String(row.id || ''),
    type,
    title: row.title || 'Notification',
    message: row.body || row.message || '',
    relatedDate: row.relatedDate || '',
    notificationDate: formatDate(row.createdAt || row.created_at),
    createdAtRaw: row.createdAt || row.created_at || null,
    postedBy: row.actorName || row.postedBy || 'System',
    isRead: Boolean(row.read ?? row.isRead),
    entityType: row.entityType || '',
    entityId: row.entityId || '',
    meta: row.entityType || '',
    source: 'backend',
  }
}

export async function listNotifications(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const params = {}
  if (options.unreadOnly) params.unreadOnly = true
  const res = await apiClient.get('/api/v1/notifications', {
    skipMock: true,
    params,
    ...options,
  })
  if (!res.success) return { ...res, data: [] }
  const rows = Array.isArray(res.data) ? res.data : []
  return { ...res, data: rows.map(mapNotificationToUi) }
}

export async function markNotificationRead(notificationId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(
    `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
    {},
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapNotificationToUi(res.data || { id: notificationId, read: true }) }
}

export async function markAllNotificationsRead(notifications = [], options = {}) {
  const unread = notifications.filter((n) => n && !n.isRead && n.id)
  if (!unread.length) return { success: true, data: notifications }
  const results = await Promise.all(unread.map((n) => markNotificationRead(n.id, options)))
  const failed = results.find((r) => !r.success)
  if (failed) return failed
  return {
    success: true,
    data: notifications.map((n) => ({ ...n, isRead: true })),
  }
}
