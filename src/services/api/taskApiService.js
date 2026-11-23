/**
 * Task management — FastAPI /api/v1/tasks*
 * Live only. No mock/localStorage fallback when the API fails.
 *
 * Backend status flow: Incomplete -> In Progress -> Completed (assignee only).
 * UI status labels used by EnterpriseTaskWorkspace: Assigned / In Progress / Completed.
 */

import { apiClient } from './apiClient.js'
import { isLiveApiEnabled } from './tokenStore.js'
import { roleCodeToLabel } from './escalationApiService.js'

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

const BACKEND_TO_UI_STATUS = Object.freeze({
  Incomplete: 'Assigned',
  'In Progress': 'In Progress',
  Completed: 'Completed',
})
const UI_TO_BACKEND_STATUS = Object.freeze({
  Assigned: 'Incomplete',
  Incomplete: 'Incomplete',
  'In Progress': 'In Progress',
  Completed: 'Completed',
})

export const toBackendTaskStatus = (status) => UI_TO_BACKEND_STATUS[status] || status

/** Backend only accepts High / Medium / Low. */
export const toBackendTaskPriority = (priority) => {
  if (priority === 'Critical' || priority === 'Urgent') return 'High'
  if (['High', 'Medium', 'Low'].includes(priority)) return priority
  return 'Medium'
}

function formatStamp(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function mapTaskToUi(row = {}) {
  const history = Array.isArray(row.history) ? row.history : []
  const status = BACKEND_TO_UI_STATUS[row.status] || row.status || 'Assigned'
  return {
    id: row.taskId || row.id || '',
    uuid: row.id || '',
    title: row.title || '',
    instructions: row.description || '',
    description: row.description || '',
    department: '',
    dueDate: row.dueDate || '',
    priority: row.priority || 'Medium',
    status,
    backendStatus: row.status || 'Incomplete',
    overdue: Boolean(row.overdue),
    scope: 'Individual',
    assigneeRole: row.assigneeRole || '',
    assigneeUserIds: row.assigneeId ? [String(row.assigneeId)] : [],
    assigneeNames: row.assignee ? [row.assignee] : [],
    assigneeEmail: row.assignee || '',
    assignedBy: row.assignedBy || '',
    assignedByEmail: row.assignedBy || '',
    assignedByRole: row.assignedByRole || '',
    assignedAt: row.assignedAt || '',
    completedAt: row.completedAt || null,
    progressPercentage: status === 'Completed' ? 100 : 0,
    statusHistory: history.map((ev, idx) => ({
      id: `${row.id}-ev-${idx}`,
      actor: ev.actor || 'System',
      timestamp: formatStamp(ev.at),
      action: String(ev.action || 'status').toUpperCase(),
      previousStatus: ev.fromStatus ? BACKEND_TO_UI_STATUS[ev.fromStatus] || ev.fromStatus : '',
      newStatus: ev.toStatus ? BACKEND_TO_UI_STATUS[ev.toStatus] || ev.toStatus : '',
      remarks: ev.remark || (ev.action === 'assigned' ? `Assigned (${roleCodeToLabel(row.assigneeRole)})` : ''),
    })),
    comments: [],
    completionEvidence: null,
    managerFeedback: null,
    source: 'backend',
  }
}

/** @param {'mine'|'assigned'|'all'} box */
export async function listTasks(box = 'mine', options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/tasks', { skipMock: true, params: { box }, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data.map(mapTaskToUi) : [] }
}

export async function getTask(taskUuid, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/tasks/${encodeURIComponent(taskUuid)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapTaskToUi(res.data || {}) }
}

export async function listTaskAssignees(role, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/tasks/assignees', {
    skipMock: true,
    params: role ? { role } : {},
    ...options,
  })
  if (!res.success) return { ...res, data: [] }
  const rows = Array.isArray(res.data) ? res.data : []
  return {
    ...res,
    data: rows.map((row) => ({
      id: String(row.id),
      name: row.email || String(row.id),
      email: row.email || '',
      roleKey: row.role || '',
      roleLabel: roleCodeToLabel(row.role),
      designation: roleCodeToLabel(row.role),
      category: roleCodeToLabel(row.role),
    })),
  }
}

export async function createTask(payload, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const body = {
    assigneeId: payload.assigneeId,
    title: String(payload.title || '').trim(),
    description: String(payload.description || '').trim() || null,
    priority: toBackendTaskPriority(payload.priority),
    dueDate: payload.dueDate,
  }
  if (payload.clientRef) body.clientRef = payload.clientRef
  const res = await apiClient.post('/api/v1/tasks', body, { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: mapTaskToUi(res.data || {}) }
}

export async function setTaskStatus(taskUuid, status, remark = '', options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(
    `/api/v1/tasks/${encodeURIComponent(taskUuid)}/status`,
    { status: toBackendTaskStatus(status), remark: String(remark || '').trim() || null },
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapTaskToUi(res.data || {}) }
}
