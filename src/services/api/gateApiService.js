/**
 * Gate Keeper — FastAPI /api/v1/ops/gate-* collections.
 * Full-collection PUT persistence (same pattern as hostel/transport).
 * FO student/hostel/material gate-passes are read via frontOfficeApiService (write is PRM/admin only).
 */

import { apiClient } from './apiClient.js'
import { isLiveApiEnabled } from './tokenStore.js'
import { listFrontOfficeCollection } from './frontOfficeApiService.js'

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

export function mapDutyToUi(row = {}) {
  const id = row.id || row.dutyId || ''
  return {
    id,
    dutyId: row.dutyId || id,
    gateKeeperName: row.gateKeeperName || row.assigneeName || '',
    employeeId: row.employeeId || row.assigneeId || '',
    assigneeEmail: String(row.assigneeEmail || row.email || '').toLowerCase(),
    gateLocation: row.gateLocation || row.location || '',
    shift: row.shift || '',
    dutyDate: row.dutyDate || row.date || '',
    startTime: row.startTime || '',
    endTime: row.endTime || '',
    assignedBy: row.assignedBy || '',
    status: row.status || row.dutyStatus || 'Pending',
    source: 'backend',
  }
}

/** Client-side “mine” filter — backend has no per-gatekeeper duty scope. */
export function isDutyAssignedToMe(duty = {}, me = {}) {
  const email = String(me.email || '').trim().toLowerCase()
  const name = String(me.name || '').trim().toLowerCase()
  const employeeId = String(me.employeeId || '').trim().toLowerCase()
  const dutyEmail = String(duty.assigneeEmail || '').trim().toLowerCase()
  const dutyName = String(duty.gateKeeperName || '').trim().toLowerCase()
  const dutyEmp = String(duty.employeeId || '').trim().toLowerCase()
  if (email && dutyEmail && dutyEmail === email) return true
  if (employeeId && dutyEmp && dutyEmp === employeeId) return true
  if (name && dutyName && dutyName === name) return true
  if (email && dutyName && dutyName.includes(email.split('@')[0])) return true
  return false
}

export function mapIncidentToUi(row = {}) {
  return {
    id: row.id || '',
    incidentType: row.incidentType || row.type || '',
    date: row.date || '',
    time: row.time || '',
    location: row.location || '',
    description: row.description || '',
    reportedBy: row.reportedBy || '',
    assignedTo: row.assignedTo || row.reportTo || '',
    priority: row.priority || 'Medium',
    status: row.status || 'Open',
    dueAt: row.dueAt || '',
    source: 'backend',
  }
}

export function mapVisitorToUi(row = {}) {
  return {
    id: row.id || '',
    visitorName: row.visitorName || row.name || '',
    phone: row.phone || '',
    personToMeet: row.personToMeet || '',
    department: row.department || '',
    purpose: row.purpose || '',
    visitorOrganization: row.visitorOrganization || row.organization || '',
    idProofType: row.idProofType || '',
    idProofNumber: row.idProofNumber || '',
    status: row.status || 'Checked In',
    checkInAt: row.checkInAt || row.checkedInAt || row._createdAt || '',
    checkOutAt: row.checkOutAt || row.checkedOutAt || '',
    remarks: row.remarks || '',
    source: 'backend',
  }
}

export function mapGatePassToUi(row = {}) {
  return {
    id: row.id || row.gatePassId || '',
    gatePassId: row.gatePassId || row.id || '',
    studentId: row.studentId || '',
    studentName: row.studentName || '',
    classSection: row.classSection || row.class || '',
    hostel: row.hostel || row.hostelName || row.blockName || '',
    leaveType: row.leaveType || row.reason || '',
    outDate: row.outDate || row.date || '',
    outTime: row.outTime || '',
    returnDate: row.returnDate || '',
    parentApproval: row.parentApproval || row.parentStatus || '',
    principalApproval: row.principalApproval || row.principalStatus || row.status || '',
    gateKeeperStatus: row.gateKeeperStatus || 'Pending',
    finalStatus: row.finalStatus || row.status || '',
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
  return { ...res, data: Array.isArray(res.data) ? res.data : body }
}

export function listGateDuties(options = {}) {
  return listCollection('/api/v1/ops/gate-duties', mapDutyToUi, options)
}

export function replaceGateDuties(rows, options = {}) {
  return replaceCollection('/api/v1/ops/gate-duties', rows, options)
}

export async function upsertGateDuty(duty, options = {}) {
  const listed = await listGateDuties(options)
  if (!listed.success) return listed
  const rows = Array.isArray(listed.data) ? [...listed.data] : []
  const next = mapDutyToUi(duty)
  if (!next.id) next.id = `GDU-${String(rows.length + 1).padStart(4, '0')}`
  if (!next.dutyId) next.dutyId = next.id
  const idx = rows.findIndex((row) => String(row.id) === String(next.id) || String(row.dutyId) === String(next.dutyId))
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next }
  else rows.unshift(next)
  const saved = await replaceGateDuties(rows, options)
  if (!saved.success) return saved
  const mapped = (saved.data || []).map(mapDutyToUi)
  return {
    ...saved,
    data: mapped.find((row) => String(row.id) === String(next.id) || String(row.dutyId) === String(next.dutyId)) || next,
    rows: mapped,
  }
}

export function listGateIncidents(options = {}) {
  return listCollection('/api/v1/ops/gate-incidents', mapIncidentToUi, options)
}

export function replaceGateIncidents(rows, options = {}) {
  return replaceCollection('/api/v1/ops/gate-incidents', rows, options)
}

export async function upsertGateIncident(incident, options = {}) {
  const listed = await listGateIncidents(options)
  if (!listed.success) return listed
  const rows = Array.isArray(listed.data) ? [...listed.data] : []
  const next = mapIncidentToUi(incident)
  if (!next.id) next.id = `GIN-${String(rows.length + 1).padStart(4, '0')}`
  const idx = rows.findIndex((row) => String(row.id) === String(next.id))
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next }
  else rows.unshift(next)
  const saved = await replaceGateIncidents(rows, options)
  if (!saved.success) return saved
  const mapped = (saved.data || []).map(mapIncidentToUi)
  return { ...saved, data: mapped.find((row) => String(row.id) === String(next.id)) || next, rows: mapped }
}

export function listGateVisitors(options = {}) {
  return listCollection('/api/v1/ops/gate-visitors', mapVisitorToUi, options)
}

export function replaceGateVisitors(rows, options = {}) {
  return replaceCollection('/api/v1/ops/gate-visitors', rows, options)
}

export async function upsertGateVisitor(visitor, options = {}) {
  const listed = await listGateVisitors(options)
  if (!listed.success) return listed
  const rows = Array.isArray(listed.data) ? [...listed.data] : []
  const next = mapVisitorToUi(visitor)
  if (!next.id) next.id = `GVS-${String(rows.length + 1).padStart(4, '0')}`
  const idx = rows.findIndex((row) => String(row.id) === String(next.id))
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next }
  else rows.unshift(next)
  const saved = await replaceGateVisitors(rows, options)
  if (!saved.success) return saved
  const mapped = (saved.data || []).map(mapVisitorToUi)
  return { ...saved, data: mapped.find((row) => String(row.id) === String(next.id)) || next, rows: mapped }
}

export async function listStudentGatePassesLive(options = {}) {
  const res = await listFrontOfficeCollection('student-gate-passes', options)
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: (res.data || []).map(mapGatePassToUi) }
}

export async function listHostelGatePassesLive(options = {}) {
  const res = await listFrontOfficeCollection('hostel-gate-passes', options)
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: (res.data || []).map(mapGatePassToUi) }
}

export async function listMaterialGatePassesLive(options = {}) {
  const res = await listFrontOfficeCollection('material-gate-passes', options)
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: (res.data || []).map(mapGatePassToUi) }
}

function mapLooseRow(row = {}, idPrefix = 'GATE') {
  const id = row.id || ''
  return {
    ...row,
    id: id || undefined,
    title: row.title || row.name || row.vendorName || row.subject || '',
    status: row.status || 'Open',
    notes: row.notes || row.remarks || row.description || '',
    source: 'backend',
    _idPrefix: idPrefix,
  }
}

async function upsertLooseCollection(listFn, replaceFn, row, idPrefix, options = {}) {
  const listed = await listFn(options)
  if (!listed.success) return listed
  const rows = Array.isArray(listed.data) ? [...listed.data] : []
  const next = mapLooseRow(row, idPrefix)
  if (!next.id) next.id = `${idPrefix}-${String(rows.length + 1).padStart(4, '0')}`
  const idx = rows.findIndex((item) => String(item.id) === String(next.id))
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next }
  else rows.unshift(next)
  const saved = await replaceFn(rows, options)
  if (!saved.success) return saved
  const mapped = (saved.data || []).map((item) => mapLooseRow(item, idPrefix))
  return {
    ...saved,
    data: mapped.find((item) => String(item.id) === String(next.id)) || next,
    rows: mapped,
  }
}

export function listGateRegisters(options = {}) {
  return listCollection('/api/v1/ops/gate-registers', (row) => mapLooseRow(row, 'GRG'), options)
}
export function replaceGateRegisters(rows, options = {}) {
  return replaceCollection('/api/v1/ops/gate-registers', rows, options)
}
export function upsertGateRegister(row, options = {}) {
  return upsertLooseCollection(listGateRegisters, replaceGateRegisters, row, 'GRG', options)
}

export function listGateHandover(options = {}) {
  return listCollection('/api/v1/ops/gate-handover', (row) => mapLooseRow(row, 'GHO'), options)
}
export function replaceGateHandover(rows, options = {}) {
  return replaceCollection('/api/v1/ops/gate-handover', rows, options)
}
export function upsertGateHandover(row, options = {}) {
  return upsertLooseCollection(listGateHandover, replaceGateHandover, row, 'GHO', options)
}

export function listGateVendors(options = {}) {
  return listCollection('/api/v1/ops/gate-vendors', (row) => mapLooseRow(row, 'GVD'), options)
}
export function replaceGateVendors(rows, options = {}) {
  return replaceCollection('/api/v1/ops/gate-vendors', rows, options)
}
export function upsertGateVendor(row, options = {}) {
  return upsertLooseCollection(listGateVendors, replaceGateVendors, row, 'GVD', options)
}

export function mapTeamAttendanceToUi(row = {}) {
  return {
    id: row.id || '',
    employeeId: row.employeeId || '',
    name: row.name || row.gateKeeperName || '',
    gate: row.gate || row.gateLocation || '',
    date: row.date || row.attendanceDate || '',
    inTime: row.inTime || row.checkInAt || '',
    outTime: row.outTime || row.checkOutAt || '',
    attendanceStatus: row.attendanceStatus || row.status || 'Present',
    source: 'backend',
  }
}

export function listGateTeamAttendance(options = {}) {
  return listCollection('/api/v1/ops/gate-team-attendance', mapTeamAttendanceToUi, options)
}
export function replaceGateTeamAttendance(rows, options = {}) {
  return replaceCollection('/api/v1/ops/gate-team-attendance', rows, options)
}
export async function upsertGateTeamAttendance(row, options = {}) {
  const listed = await listGateTeamAttendance(options)
  if (!listed.success) return listed
  const rows = Array.isArray(listed.data) ? [...listed.data] : []
  const next = mapTeamAttendanceToUi(row)
  if (!next.id) next.id = `GTA-${String(rows.length + 1).padStart(4, '0')}`
  const idx = rows.findIndex((item) => String(item.id) === String(next.id))
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next }
  else rows.unshift(next)
  const saved = await replaceGateTeamAttendance(rows, options)
  if (!saved.success) return saved
  const mapped = (saved.data || []).map(mapTeamAttendanceToUi)
  return {
    ...saved,
    data: mapped.find((item) => String(item.id) === String(next.id)) || next,
    rows: mapped,
  }
}
