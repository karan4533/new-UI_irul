/**
 * Live tasks — FastAPI /api/v1/tasks*
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

/** Map backend Incomplete → Assigned for EnterpriseTaskWorkspace display badges/actions. */
export function mapBackendTaskStatusToUi(status) {
  if (status === 'Incomplete') return 'Assigned'
  return status || 'Assigned'
}

/** Map UI status back to backend Incomplete | In Progress | Completed. */
export function mapUiTaskStatusToBackend(status) {
  if (status === 'Incomplete' || status === 'In Progress' || status === 'Completed') return status
  if (status === 'Assigned' || status === 'Acknowledged' || status === 'Draft') return 'Incomplete'
  if (status === 'Submitted' || status === 'Submitted for Verification') return 'In Progress'
  if (status === 'Closed') return 'Completed'
  return null
}

export function mapTaskToUi(row = {}) {
  const backendStatus = row.status || 'Incomplete'
  const assigneeName = row.assigneeName || row.assignee || ''
  const description = row.description || ''
  return {
    id: row.id,
    taskId: row.taskId || row.id || '',
    title: row.title || '',
    description,
    instructions: description,
    priority: row.priority || 'Medium',
    status: mapBackendTaskStatusToUi(backendStatus),
    backendStatus,
    dueDate: row.dueDate || '',
    assigneeId: row.assigneeId || '',
    assigneeName,
    assigneeNames: assigneeName ? [assigneeName] : [],
    assigneeRole: row.assigneeRole || '',
    assigneeUserIds: row.assigneeId ? [row.assigneeId] : [],
    assignedBy: row.assignedBy || row.creatorName || '',
    assignedByRole: row.assignedByRole || '',
    department: row.department || '',
    createdAt: row.createdAt || row.assignedAt || '',
    history: row.history || [],
    statusHistory: row.history || [],
    overdue: Boolean(row.overdue),
    remark: row.remark || '',
    dataSource: 'backend',
  }
}

export async function listTasks(params = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const query = { box: params.box || 'mine' }
  if (params.status) query.status = params.status
  const res = await apiClient.get('/api/v1/tasks', { skipMock: true, params: query, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data.map(mapTaskToUi) : [] }
}

export async function getTask(taskId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/tasks/${encodeURIComponent(taskId)}`, { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: mapTaskToUi(res.data || {}) }
}

export async function listTaskAssignees(params = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const query = {}
  if (params.role) query.role = params.role
  const res = await apiClient.get('/api/v1/tasks/assignees', { skipMock: true, params: query, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data : [] }
}

export async function createTask(body = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post('/api/v1/tasks', body || {}, { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: mapTaskToUi(res.data || {}) }
}

export async function setTaskStatus(taskId, { status, remark = null } = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(
    `/api/v1/tasks/${encodeURIComponent(taskId)}/status`,
    { status, remark },
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapTaskToUi(res.data || {}) }
}
