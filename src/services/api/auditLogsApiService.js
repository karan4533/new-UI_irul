/**
 * Campus audit trail — FastAPI GET /api/v1/audit-logs
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

function formatTimestamp(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function parseDetails(details) {
  if (details == null || details === '') return { text: '—', oldValue: '—', newValue: '—' }
  if (typeof details === 'object') {
    return {
      text: JSON.stringify(details, null, 2),
      oldValue: details.before != null ? JSON.stringify(details.before) : (details.oldValue ?? '—'),
      newValue: details.after != null ? JSON.stringify(details.after) : (details.newValue ?? '—'),
    }
  }
  const text = String(details)
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object') {
      return {
        text: JSON.stringify(parsed, null, 2),
        oldValue: parsed.before != null ? JSON.stringify(parsed.before) : (parsed.oldValue ?? '—'),
        newValue: parsed.after != null ? JSON.stringify(parsed.after) : (parsed.newValue ?? '—'),
      }
    }
  } catch {
    /* plain string */
  }
  return { text, oldValue: '—', newValue: text }
}

/** Derive a short Browser · OS label from a User-Agent string. */
export function parseDeviceFromUserAgent(userAgent) {
  const ua = String(userAgent || '').trim()
  if (!ua) return '—'

  let browser = 'Browser'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera'
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome'
  else if (/Safari\//i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) browser = 'Safari'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/MSIE|Trident/i.test(ua)) browser = 'IE'

  let os = 'Unknown OS'
  if (/Windows NT 10/i.test(ua)) os = 'Win 10/11'
  else if (/Windows NT 6\.3/i.test(ua)) os = 'Win 8.1'
  else if (/Windows NT 6\.1/i.test(ua)) os = 'Win 7'
  else if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Mac OS X/i.test(ua)) os = 'macOS'
  else if (/Linux/i.test(ua)) os = 'Linux'
  else if (/CrOS/i.test(ua)) os = 'Chrome OS'

  return `${browser} · ${os}`
}

export function mapAuditLogToUi(row = {}, logType = 'audit-logs') {
  const detail = parseDetails(row.details)
  const isSystem = !row.actor_id
  const actorName = row.actor_name || (row.actor_id ? 'Unknown user' : 'System')
  const loginStatus = /LOGIN_LOCK|OTP_|UNKNOWN|FAIL/i.test(row.action || '')
    ? (/LOCK|BLOCK/i.test(row.action || '') ? 'Blocked' : 'Failed')
    : (/LOGOUT/i.test(row.action || '') ? 'Logout' : 'Success')

  return {
    id: String(row.id || ''),
    logType,
    source: 'backend',
    timestamp: formatTimestamp(row.created_at),
    createdAtRaw: row.created_at || null,
    user: actorName,
    userId: row.actor_id || '—',
    userEmail: row.actor_email || '—',
    role: row.actor_role_label || row.actor_role || (isSystem ? 'System' : '—'),
    action: row.action || '—',
    module: row.entity_type || '—',
    description: detail.text,
    details: detail.text,
    findings: detail.text,
    remarks: detail.text,
    recordId: row.entity_id || '—',
    recordName: row.entity_id || '—',
    referenceId: row.entity_id || '—',
    referenceTitle: row.entity_type || '—',
    auditId: String(row.id || ''),
    auditType: row.action || row.entity_type || 'Audit',
    scope: row.entity_type || '—',
    result: row.action || 'Completed',
    changeType: row.action || 'Update',
    fieldChanged: '—',
    oldValue: detail.oldValue,
    newValue: detail.newValue,
    deletedBy: actorName,
    reason: detail.text !== '—' ? detail.text : (row.action || '—'),
    canRestore: false,
    ipAddress: row.ip_address || '—',
    userAgent: row.user_agent || '',
    status:
      logType === 'login-history' || logType === 'failed-logins'
        ? loginStatus
        : (row.action || 'Completed'),
    username: row.actor_email || actorName,
    device: parseDeviceFromUserAgent(row.user_agent),
    location: '—',
    attempts: '—',
  }
}

function matchesLogType(row, logType) {
  const action = String(row.action || '')
  if (logType === 'audit-logs' || logType === 'data-changes') return true
  if (logType === 'login-history') return /LOGIN|LOGOUT|OTP/i.test(action)
  if (logType === 'failed-logins') return /LOGIN_FAIL|LOGIN_LOCK|OTP_FAIL|UNKNOWN/i.test(action)
  if (logType === 'approval-actions') return /APPROV|DECIDE|DENY/i.test(action)
  if (logType === 'deleted-records') return /DELETE|REMOVE/i.test(action)
  return true
}

export async function listAuditLogs(logType = 'audit-logs', options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/audit-logs', { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  const rows = Array.isArray(res.data) ? res.data : []
  return {
    ...res,
    data: rows
      .filter((row) => matchesLogType(row, logType))
      .map((row) => mapAuditLogToUi(row, logType)),
  }
}

export async function getAuditLog(logId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/audit-logs/${encodeURIComponent(logId)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapAuditLogToUi(res.data || {}, 'audit-logs') }
}
