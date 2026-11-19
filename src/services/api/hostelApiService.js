/**
 * Hostel Warden — FastAPI /api/v1/ops/hostel-assignments|hostel-payments
 * Full-collection PUT persistence (same pattern as library). No mock fallback when live fails.
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

export function mapAssignmentToUi(row = {}) {
  return {
    id: row.id || '',
    studentId: row.studentId || '',
    studentName: row.studentName || '',
    admissionNumber: row.admissionNumber || '',
    classSection: row.classSection || '',
    gender: row.gender || '',
    blockName: row.blockName || row.hostelBlockName || '',
    roomNumber: row.roomNumber || '',
    bedNumber: row.bedNumber || '',
    status: row.status || 'Active',
    checkInDate: row.checkInDate || '',
    checkOutDate: row.checkOutDate || '',
    emergencyContact: row.emergencyContact || '',
    remarks: row.remarks || '',
    source: 'backend',
  }
}

export function mapPaymentToUi(row = {}) {
  return {
    id: row.id || '',
    studentId: row.studentId || '',
    studentName: row.studentName || '',
    admissionNumber: row.admissionNumber || '',
    amount: Number(row.amount) || 0,
    status: row.status || 'Pending',
    dueDate: row.dueDate || '',
    paidDate: row.paidDate || '',
    remarks: row.remarks || '',
    source: 'backend',
  }
}

async function listCollection(path, mapper, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get(path, { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data.map(mapper) : [] }
}

async function replaceCollection(path, rows, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const body = Array.isArray(rows) ? rows : []
  const res = await apiClient.put(path, body, { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data.map((row) => row) : body }
}

export function listHostelAssignments(options = {}) {
  return listCollection('/api/v1/ops/hostel-assignments', mapAssignmentToUi, options)
}

export function replaceHostelAssignments(rows, options = {}) {
  return replaceCollection('/api/v1/ops/hostel-assignments', rows, options)
}

export function listHostelPayments(options = {}) {
  return listCollection('/api/v1/ops/hostel-payments', mapPaymentToUi, options)
}

export function replaceHostelPayments(rows, options = {}) {
  return replaceCollection('/api/v1/ops/hostel-payments', rows, options)
}

/** Append one assignment (read-modify-write full collection). */
export async function upsertHostelAssignment(assignment, options = {}) {
  const listed = await listHostelAssignments(options)
  if (!listed.success) return listed
  const rows = Array.isArray(listed.data) ? [...listed.data] : []
  const next = mapAssignmentToUi(assignment)
  if (!next.id) {
    next.id = `HAS-${String(rows.length + 1).padStart(4, '0')}`
  }
  const idx = rows.findIndex((row) => String(row.id) === String(next.id))
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next }
  else rows.unshift(next)
  const saved = await replaceHostelAssignments(rows, options)
  if (!saved.success) return saved
  const mapped = (saved.data || []).map(mapAssignmentToUi)
  return { ...saved, data: mapped.find((row) => String(row.id) === String(next.id)) || next, rows: mapped }
}

export async function upsertHostelPayment(payment, options = {}) {
  const listed = await listHostelPayments(options)
  if (!listed.success) return listed
  const rows = Array.isArray(listed.data) ? [...listed.data] : []
  const next = mapPaymentToUi(payment)
  if (!next.id) {
    next.id = `HPY-${String(rows.length + 1).padStart(4, '0')}`
  }
  const idx = rows.findIndex((row) => String(row.id) === String(next.id))
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next }
  else rows.unshift(next)
  const saved = await replaceHostelPayments(rows, options)
  if (!saved.success) return saved
  const mapped = (saved.data || []).map(mapPaymentToUi)
  return { ...saved, data: mapped.find((row) => String(row.id) === String(next.id)) || next, rows: mapped }
}
