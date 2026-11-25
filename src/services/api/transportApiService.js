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

export function mapVehicleHealthToUi(row = {}) {
  return {
    id: row.id || '',
    vehicleNumber: row.vehicleNumber || '',
    inspectionDate: row.inspectionDate || row.date || '',
    engineStatus: row.engineStatus || '',
    tyreCondition: row.tyreCondition || '',
    brakeCondition: row.brakeCondition || '',
    lightsStatus: row.lightsStatus || '',
    overallCondition: row.overallCondition || row.status || '',
    remarks: row.remarks || '',
    source: 'backend',
  }
}

export function mapDriverFuelToUi(row = {}) {
  return {
    id: row.id || row.fuelRequestId || '',
    fuelRequestId: row.fuelRequestId || row.id || '',
    vehicleNumber: row.vehicleNumber || '',
    fuelType: row.fuelType || '',
    quantityLitres: row.quantityLitres || row.quantity || '',
    estimatedCost: row.estimatedCost || row.amount || '',
    requestDate: row.requestDate || row.date || '',
    approvalStatus: row.approvalStatus || row.status || 'Pending',
    remarks: row.remarks || '',
    source: 'backend',
  }
}

export function mapDriverMaintenanceToUi(row = {}) {
  return {
    id: row.id || row.maintenanceRequestId || '',
    maintenanceRequestId: row.maintenanceRequestId || row.id || '',
    vehicleNumber: row.vehicleNumber || '',
    issueType: row.issueType || row.category || '',
    priority: row.priority || 'Medium',
    requestDate: row.requestDate || row.date || '',
    approvalStatus: row.approvalStatus || row.status || 'Pending',
    description: row.description || row.remarks || '',
    source: 'backend',
  }
}

export const listTransportVehicleHealth = (options) =>
  listCollection('/api/v1/ops/transport-vehicle-health', mapVehicleHealthToUi, options)
export const replaceTransportVehicleHealth = (rows, options) =>
  replaceCollection('/api/v1/ops/transport-vehicle-health', rows, options)
export const upsertTransportVehicleHealth = (row, options) =>
  upsertRow(listTransportVehicleHealth, replaceTransportVehicleHealth, mapVehicleHealthToUi, 'VHS', row, options)

export const listTransportDriverFuel = (options) =>
  listCollection('/api/v1/ops/transport-driver-fuel', mapDriverFuelToUi, options)
export const replaceTransportDriverFuel = (rows, options) =>
  replaceCollection('/api/v1/ops/transport-driver-fuel', rows, options)
export const upsertTransportDriverFuel = (row, options) =>
  upsertRow(listTransportDriverFuel, replaceTransportDriverFuel, mapDriverFuelToUi, 'TDF', row, options)

export const listTransportDriverMaintenance = (options) =>
  listCollection('/api/v1/ops/transport-driver-maintenance', mapDriverMaintenanceToUi, options)
export const replaceTransportDriverMaintenance = (rows, options) =>
  replaceCollection('/api/v1/ops/transport-driver-maintenance', rows, options)
export const upsertTransportDriverMaintenance = (row, options) =>
  upsertRow(
    listTransportDriverMaintenance,
    replaceTransportDriverMaintenance,
    mapDriverMaintenanceToUi,
    'TDM',
    row,
    options,
  )

export function mapRouteStopToUi(row = {}) {
  return {
    id: row.id || '',
    stopNo: Number(row.stopNo) || 0,
    pickupPoint: row.pickupPoint || row.stopName || row.name || '',
    arrivalTime: row.arrivalTime || '',
    departureTime: row.departureTime || '',
    studentsBoarding: Number(row.studentsBoarding) || 0,
    landmark: row.landmark || '',
    className: row.className || '',
    section: row.section || '',
    day: row.day || '',
    routeName: row.routeName || row.route || '',
    vehicleNumber: row.vehicleNumber || '',
    source: 'backend',
  }
}

export function mapStudentAttendanceToUi(row = {}) {
  const morning = row.morning && typeof row.morning === 'object' ? row.morning : {}
  const evening = row.evening && typeof row.evening === 'object' ? row.evening : {}
  return {
    id: row.id || '',
    attendanceDate: row.attendanceDate || row.date || '',
    studentId: row.studentId || '',
    studentName: row.studentName || '',
    classSection: row.classSection || '',
    busStop: row.busStop || row.stopName || '',
    profileImage: row.profileImage || null,
    vehicleNumber: row.vehicleNumber || '',
    routeName: row.routeName || '',
    driverEmail: row.driverEmail || row.email || '',
    morning: {
      pickup: morning.pickup || 'Pending',
      drop: morning.drop || 'Pending',
    },
    evening: {
      pickup: evening.pickup || 'Pending',
      drop: evening.drop || 'Pending',
    },
    remarks: row.remarks || '',
    source: 'backend',
  }
}

export const listTransportRouteStops = (options) =>
  listCollection('/api/v1/ops/transport-route-stops', mapRouteStopToUi, options)
export const replaceTransportRouteStops = (rows, options) =>
  replaceCollection('/api/v1/ops/transport-route-stops', rows, options)
export const upsertTransportRouteStop = (row, options) =>
  upsertRow(listTransportRouteStops, replaceTransportRouteStops, mapRouteStopToUi, 'TRS', row, options)

export const listTransportStudentAttendance = (options) =>
  listCollection('/api/v1/ops/transport-student-attendance', mapStudentAttendanceToUi, options)
export const replaceTransportStudentAttendance = (rows, options) =>
  replaceCollection('/api/v1/ops/transport-student-attendance', rows, options)
export const upsertTransportStudentAttendance = (row, options) =>
  upsertRow(
    listTransportStudentAttendance,
    replaceTransportStudentAttendance,
    mapStudentAttendanceToUi,
    'TST',
    row,
    options,
  )

export function mapMaintenanceToUi(row = {}) {
  const cost = row.estimatedCost ?? row.cost ?? ''
  return {
    id: row.id || row.serviceId || '',
    serviceId: row.serviceId || row.id || '',
    vehicleNumber: row.vehicleNumber || '',
    vehicleType: row.vehicleType || '',
    lastServiceDate: row.lastServiceDate || '',
    nextServiceDate: row.nextServiceDate || '',
    serviceType: row.serviceType || row.issueType || '',
    serviceCenter: row.serviceCenter || row.workshop || '',
    estimatedCost: typeof cost === 'number' ? `₹${cost.toLocaleString('en-IN')}` : String(cost || ''),
    status: row.status || 'Scheduled',
    remarks: row.remarks || '',
    source: 'backend',
  }
}

export function mapExpenseToUi(row = {}) {
  return {
    id: row.id || '',
    expenseId: row.expenseId || row.id || '',
    category: row.category || row.expenseType || 'other',
    vehicleNumber: row.vehicleNumber || '',
    driverName: row.driverName || '',
    amount: Number(row.amount) || 0,
    paymentMode: row.paymentMode || '',
    expenseDate: row.expenseDate || row.date || '',
    serviceType: row.serviceType || '',
    otherType: row.otherType || '',
    fuelType: row.fuelType || '',
    quantityLitres: row.quantityLitres || row.quantity || '',
    remarks: row.remarks || '',
    status: row.status || 'Recorded',
    source: 'backend',
  }
}

export function mapApprovalRequestToUi(row = {}) {
  return {
    id: row.id || row.requestId || '',
    requestId: row.requestId || row.id || '',
    type: row.type || 'General',
    vehicleNumber: row.vehicleNumber || '',
    reportedBy: row.reportedBy || row.driverName || '',
    driverName: row.driverName || row.reportedBy || '',
    requestDate: row.requestDate || row.date || '',
    issueType: row.issueType || row.category || '',
    description: row.description || row.remarks || '',
    priority: row.priority || 'Medium',
    status: row.status || row.approvalStatus || 'Pending',
    estimatedCost: Number(row.estimatedCost) || 0,
    workshop: row.workshop || '',
    fuelType: row.fuelType || '',
    quantityLitres: row.quantityLitres || '',
    approverRemarks: row.approverRemarks || '',
    rejectionReason: row.rejectionReason || '',
    source: 'backend',
  }
}

export const listTransportMaintenance = (options) =>
  listCollection('/api/v1/ops/transport-maintenance', mapMaintenanceToUi, options)
export const replaceTransportMaintenance = (rows, options) =>
  replaceCollection('/api/v1/ops/transport-maintenance', rows, options)
export const upsertTransportMaintenance = (row, options) =>
  upsertRow(listTransportMaintenance, replaceTransportMaintenance, mapMaintenanceToUi, 'TMN', row, options)

export const listTransportExpenses = (options) =>
  listCollection('/api/v1/ops/transport-expenses', mapExpenseToUi, options)
export const replaceTransportExpenses = (rows, options) =>
  replaceCollection('/api/v1/ops/transport-expenses', rows, options)
export const upsertTransportExpense = (row, options) =>
  upsertRow(listTransportExpenses, replaceTransportExpenses, mapExpenseToUi, 'TEX', row, options)

export const listTransportApprovalRequests = (options) =>
  listCollection('/api/v1/ops/transport-approval-requests', mapApprovalRequestToUi, options)
export const replaceTransportApprovalRequests = (rows, options) =>
  replaceCollection('/api/v1/ops/transport-approval-requests', rows, options)
export const upsertTransportApprovalRequest = (row, options) =>
  upsertRow(
    listTransportApprovalRequests,
    replaceTransportApprovalRequests,
    mapApprovalRequestToUi,
    'TAR',
    row,
    options,
  )
