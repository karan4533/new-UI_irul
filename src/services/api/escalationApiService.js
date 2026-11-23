/**
 * Escalations — FastAPI /api/v1/escalations*
 * Live only. No mock/localStorage fallback when the API fails.
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

/** Backend role codes → display labels (mirrors app.permissions.matrix.ALL_ROLES). */
const ROLE_LABELS = Object.freeze({
  superadmin: 'Super Admin',
  admin: 'Admin',
  director: 'Director',
  managing_director: 'Managing Director',
  principal: 'Principal',
  coordinator: 'Coordinator',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  librarian: 'Librarian',
  prm: 'PRM (Front Office)',
  pro: 'Public Relations Officer',
  gatekeeper: 'Gate Keeper',
  gatekeepermanager: 'Gate Keeper Manager',
  hr: 'HR Manager',
})

export function roleCodeToLabel(code) {
  if (!code) return ''
  const key = String(code).toLowerCase()
  if (ROLE_LABELS[key]) return ROLE_LABELS[key]
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDdMmYyyy(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getFullYear()}`
}

export function mapEscalationToUi(row = {}) {
  const trail = Array.isArray(row.trail) ? row.trail : []
  return {
    id: row.id || '',
    displayId: row.escalationId || row.id || '',
    escalationId: row.escalationId || '',
    escalatedBy: row.escalatedBy || '',
    escalatedByEmail: row.escalatedBy || '',
    escalatedByRole: roleCodeToLabel(row.escalatedByRoleKey),
    escalatedByRoleKey: row.escalatedByRoleKey || '',
    escalatedTo: roleCodeToLabel(row.escalatedToRoleKey),
    escalatedToRoleKey: row.escalatedToRoleKey || '',
    escalatedToUserId: row.escalatedToUserId || '',
    escalatedToUserName: row.escalatedToUserEmail || '',
    escalatedToUserEmail: row.escalatedToUserEmail || '',
    description: row.description || '',
    fullDescription: row.fullDescription || '',
    remarks: row.remarks || '',
    status: row.status || 'Pending',
    resolutionRemarks: row.resolutionNote || '',
    level: row.level ?? 0,
    escalationDate: formatDdMmYyyy(row.escalatedAt),
    escalatedAt: row.escalatedAt || '',
    resolveBy: row.resolveBy || '',
    overdue: Boolean(row.overdue),
    resolvedAt: row.resolvedAt || null,
    trail,
    attachment: '',
    attachmentSize: '',
    attachmentType: '',
    source: 'backend',
  }
}

/** @param {'mine'|'received'|'all'} box */
export async function listEscalations(box = 'mine', options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/escalations', {
    skipMock: true,
    params: { box },
    ...options,
  })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data.map(mapEscalationToUi) : [] }
}

export async function getEscalation(escalationId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/escalations/${encodeURIComponent(escalationId)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapEscalationToUi(res.data || {}) }
}

export async function listEscalationRecipients(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/escalations/recipients', { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  const rows = Array.isArray(res.data) ? res.data : []
  return {
    ...res,
    data: rows.map((row) => ({
      value: String(row.id),
      label: row.email || String(row.id),
      subLabel: roleCodeToLabel(row.role),
      id: String(row.id),
      name: row.email || String(row.id),
      email: row.email || '',
    })),
  }
}

export async function raiseEscalation(payload, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const body = {
    description: String(payload.description || '').trim(),
  }
  const full = String(payload.fullDescription || '').trim()
  if (full) body.fullDescription = full
  const remarks = String(payload.remarks || '').trim()
  if (remarks) body.remarks = remarks
  if (payload.recipientUserId) body.recipientUserId = payload.recipientUserId
  const res = await apiClient.post('/api/v1/escalations', body, { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: mapEscalationToUi(res.data || {}) }
}

export async function updateEscalationStatus(escalationId, status, note = '', options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(
    `/api/v1/escalations/${encodeURIComponent(escalationId)}/status`,
    { status, note: String(note || '').trim() || null },
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapEscalationToUi(res.data || {}) }
}
