/**
 * Transport Manager — FastAPI /api/v1/ops/transport-* collections.
 * Full-collection PUT persistence (same pattern as hostel/library). No mock fallback when live fails.
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

export function mapDriverToUi(row = {}) {
  return {
    id: row.id || '',
    firstName: row.firstName || '',
    middleName: row.middleName || '',
    lastName: row.lastName || '',
    name: row.name || [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '),
    gender: row.gender || '',
    mobileNumber: row.mobileNumber || row.phone || '',
    email: row.email || '',
    licenseNumber: row.licenseNumber || '',
    licenseExpiry: row.licenseExpiry || '',
    experience: row.experience || '',
    vehicleNumber: row.vehicleNumber || '',
    routeAssigned: row.routeAssigned || row.routeName || '',
    status: row.status || 'Active',
    workShift: row.workShift || '',
    remarks: row.remarks || '',
    source: 'backend',
  }
}

export function mapVehicleToUi(row = {}) {
  return {
    id: row.id || '',
    vehicleNumber: row.vehicleNumber || row.registration || '',
    vehicleType: row.vehicleType || row.type || '',
    category: row.category || 'Bus',
    capacity: Number(row.capacity) || 0,
    driverName: row.driverName || '',
    driverContact: row.driverContact || '',
    status: row.status || 'Active',
    lastServiceDate: row.lastServiceDate || '',
    nextServiceDate: row.nextServiceDate || '',
    insuranceExpiryDate: row.insuranceExpiryDate || '',
    operationalState: row.operationalState || row.status || 'Ready',
    remarks: row.remarks || '',
    source: 'backend',
  }
}

export function mapRouteToUi(row = {}) {
  return {
    id: row.id || '',
    routeName: row.routeName || row.name || '',
    startLocation: row.startLocation || '',
    endLocation: row.endLocation || '',
    vehicleId: row.vehicleId || '',
    vehicleNumber: row.vehicleNumber || '',
    driverName: row.driverName || '',
    driverContact: row.driverContact || '',
    totalStops: Number(row.totalStops) || (Array.isArray(row.stops) ? row.stops.length : 0),
    status: row.status || 'Active',
    operationalState: row.operationalState || row.status || 'Ready',
    remarks: row.remarks || '',
    source: 'backend',
  }
}

export function mapStudentAssignmentToUi(row = {}) {
  return {
    id: row.id || '',
    studentId: row.studentId || '',
    studentName: row.studentName || '',
    admissionNumber: row.admissionNumber || '',
    classSection: row.classSection || '',
    routeId: row.routeId || '',
    routeName: row.routeName || '',
    stopName: row.stopName || '',
    vehicleNumber: row.vehicleNumber || '',
    status: row.status || 'Active',
    remarks: row.remarks || '',
    source: 'backend',
  }
}

export function mapDutyToUi(row = {}) {
  return {
    id: row.id || '',
    dutyDate: row.dutyDate || '',
    routeId: row.routeId || '',
    routeName: row.routeName || '',
    vehicleId: row.vehicleId || '',
    vehicleNumber: row.vehicleNumber || '',
    driverId: row.driverId || '',
    driverName: row.driverName || '',
    shift: row.shift || '',
    status: row.status || 'Scheduled',
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
  return { ...res, data: Array.isArray(res.data) ? res.data : body }
}

async function upsertRow(listFn, replaceFn, mapper, prefix, row, options = {}) {
  const listed = await listFn(options)
  if (!listed.success) return listed
  const rows = Array.isArray(listed.data) ? [...listed.data] : []
  const next = mapper(row)
  if (!next.id) next.id = `${prefix}-${String(rows.length + 1).padStart(4, '0')}`
  const idx = rows.findIndex((item) => String(item.id) === String(next.id))
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next }
  else rows.unshift(next)
  const saved = await replaceFn(rows, options)
  if (!saved.success) return saved
  const mapped = (saved.data || []).map(mapper)
  return { ...saved, data: mapped.find((item) => String(item.id) === String(next.id)) || next, rows: mapped }
}

export const listTransportDrivers = (options) =>
  listCollection('/api/v1/ops/transport-drivers', mapDriverToUi, options)
export const replaceTransportDrivers = (rows, options) =>
  replaceCollection('/api/v1/ops/transport-drivers', rows, options)
export const upsertTransportDriver = (row, options) =>
  upsertRow(listTransportDrivers, replaceTransportDrivers, mapDriverToUi, 'TDR', row, options)

export const listTransportVehicles = (options) =>
  listCollection('/api/v1/ops/transport-vehicles', mapVehicleToUi, options)
export const replaceTransportVehicles = (rows, options) =>
  replaceCollection('/api/v1/ops/transport-vehicles', rows, options)
export const upsertTransportVehicle = (row, options) =>
  upsertRow(listTransportVehicles, replaceTransportVehicles, mapVehicleToUi, 'TVH', row, options)

export const listTransportRoutes = (options) =>
  listCollection('/api/v1/ops/transport-routes', mapRouteToUi, options)
export const replaceTransportRoutes = (rows, options) =>
  replaceCollection('/api/v1/ops/transport-routes', rows, options)
export const upsertTransportRoute = (row, options) =>
  upsertRow(listTransportRoutes, replaceTransportRoutes, mapRouteToUi, 'TRT', row, options)

export const listTransportStudentAssignments = (options) =>
  listCollection('/api/v1/ops/transport-student-assignments', mapStudentAssignmentToUi, options)
export const replaceTransportStudentAssignments = (rows, options) =>
  replaceCollection('/api/v1/ops/transport-student-assignments', rows, options)
export const upsertTransportStudentAssignment = (row, options) =>
  upsertRow(
    listTransportStudentAssignments,
    replaceTransportStudentAssignments,
    mapStudentAssignmentToUi,
    'TSA',
    row,
    options,
  )

export const listTransportDuties = (options) =>
  listCollection('/api/v1/ops/transport-duties', mapDutyToUi, options)
export const replaceTransportDuties = (rows, options) =>
  replaceCollection('/api/v1/ops/transport-duties', rows, options)
export const upsertTransportDuty = (row, options) =>
  upsertRow(listTransportDuties, replaceTransportDuties, mapDutyToUi, 'TDY', row, options)
