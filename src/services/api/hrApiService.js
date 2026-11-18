/**
 * Live HR Employees API — FastAPI /api/v1/hr/*
 * No mock/localStorage fallback. Callers must handle errors.
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

/** Map typed EmployeeOut → UI row shape used by HR pages. */
export function mapEmployeeOutToUi(row = {}) {
  const first = row.first_name || ''
  const last = row.last_name && row.last_name !== '-' ? row.last_name : ''
  const name = `${first} ${last}`.trim() || row.name || ''
  return {
    id: row.employee_code || row.id,
    uuid: row.id,
    name,
    first_name: first,
    last_name: last,
    email: row.email || '',
    contact: row.phone || '',
    phone: row.phone || '',
    department: row.department || '',
    designation: row.designation || '',
    joiningDate: row.joining_date || '',
    status: row.status || 'Active',
    employmentType: row.employment_type || '',
    category: row.category || '',
    grossSalary: row.gross_salary ?? 0,
    source: 'backend',
  }
}

/** Portal payload already matches UI field names. */
export function mapPortalEmployeeToUi(row = {}) {
  return {
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    gender: row.gender || '',
    dateOfBirth: row.dateOfBirth || '',
    contact: row.contact || '',
    address: row.address || '',
    department: row.department || '',
    designation: row.designation || '',
    joiningDate: row.joiningDate || '',
    status: row.status || 'Active',
    reportingManager: row.reportingManager || '',
    role: row.role || '',
    qualification: row.qualification || '',
    experience: row.experience || '',
    emergencyContact: row.emergencyContact || '',
    employmentType: row.employmentType || '',
    category: row.category || '',
    grossSalary: row.grossSalary ?? 0,
    otherAllowance: row.otherAllowance ?? 0,
    specialDeduction: row.specialDeduction ?? 0,
    otherEmployerBenefits: row.otherEmployerBenefits ?? 0,
    source: 'backend',
  }
}

export function splitFullName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: '', last_name: '-' }
  if (parts.length === 1) return { first_name: parts[0], last_name: '-' }
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
}

export function uiFormToEmployeeCreate(form) {
  const { first_name, last_name } = splitFullName(form.name)
  return {
    first_name,
    last_name,
    email: String(form.email || '').trim().toLowerCase(),
    phone: form.contact || null,
    department: form.department || null,
    designation: form.designation || null,
    joining_date: form.joiningDate || null,
    status: form.status || 'Active',
    employment_type: form.employmentType || null,
    category: form.category || null,
    gross_salary: form.grossSalary === '' || form.grossSalary == null ? 0 : Number(form.grossSalary) || 0,
  }
}

export function uiFormToPortalRow(form, existingId) {
  return {
    id: existingId || form.id,
    name: form.name || '',
    email: String(form.email || '').trim().toLowerCase(),
    gender: form.gender || '',
    dateOfBirth: form.dateOfBirth || '',
    contact: form.contact || '',
    address: form.address || '',
    department: form.department || '',
    designation: form.designation || '',
    joiningDate: form.joiningDate || '',
    status: form.status || 'Active',
    reportingManager: form.reportingManager || '',
    role: form.role || '',
    qualification: form.qualification || '',
    experience: form.experience || '',
    emergencyContact: form.emergencyContact || '',
    employmentType: form.employmentType || '',
    category: form.category || '',
    grossSalary: form.grossSalary === '' || form.grossSalary == null ? 0 : Number(form.grossSalary) || 0,
    otherAllowance: form.otherAllowance ?? 0,
    specialDeduction: form.specialDeduction ?? 0,
    otherEmployerBenefits: form.otherEmployerBenefits ?? 0,
  }
}

export async function listEmployees(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/hr/employees', { skipMock: true, ...options })
  if (!res.success) return res
  const rows = Array.isArray(res.data) ? res.data.map(mapEmployeeOutToUi) : []
  return { ...res, data: rows }
}

/** Richer list matching HR UI field names. */
export async function listPortalEmployees(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/hr/portal/employees', { skipMock: true, ...options })
  if (!res.success) return res
  const rows = Array.isArray(res.data) ? res.data.map(mapPortalEmployeeToUi) : []
  return { ...res, data: rows }
}

export async function getEmployee(employeeCode, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/hr/employees/${encodeURIComponent(employeeCode)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapEmployeeOutToUi(res.data || {}) }
}

/**
 * Create via typed POST /employees (server assigns employee_code).
 * Then merges extended portal fields via PUT /portal/employees (must send full list).
 */
export async function createEmployee(form, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked

  const payload = uiFormToEmployeeCreate(form)
  const created = await apiClient.post('/api/v1/hr/employees', payload, { skipMock: true, ...options })
  if (!created.success) return created

  const mapped = mapEmployeeOutToUi(created.data || {})
  const code = mapped.id
  if (!code) return { success: false, error: 'Create succeeded but no employee_code was returned.', data: null }

  // Merge extended UI fields the typed create schema does not accept.
  const portal = await listPortalEmployees(options)
  if (!portal.success) {
    return { success: true, data: mapped, warning: portal.error || 'Created, but could not load portal list to save extended fields.' }
  }

  const portalRow = uiFormToPortalRow({ ...form, id: code }, code)
  const nextList = portal.data.map((row) => (row.id === code ? { ...row, ...portalRow, id: code } : {
    id: row.id,
    name: row.name,
    email: row.email,
    gender: row.gender,
    dateOfBirth: row.dateOfBirth,
    contact: row.contact,
    address: row.address,
    department: row.department,
    designation: row.designation,
    joiningDate: row.joiningDate,
    status: row.status,
    reportingManager: row.reportingManager,
    role: row.role,
    qualification: row.qualification,
    experience: row.experience,
    emergencyContact: row.emergencyContact,
    employmentType: row.employmentType,
    category: row.category,
    grossSalary: row.grossSalary,
    otherAllowance: row.otherAllowance,
    specialDeduction: row.specialDeduction,
    otherEmployerBenefits: row.otherEmployerBenefits,
  }))

  // Ensure the new code is present (typed create may not yet appear in portal mapping edge cases).
  if (!nextList.some((row) => row.id === code)) {
    nextList.push(portalRow)
  }

  const saved = await apiClient.put('/api/v1/hr/portal/employees', nextList, { skipMock: true, ...options })
  if (!saved.success) {
    return { success: true, data: mapped, warning: saved.error || 'Employee created; extended portal fields were not saved.' }
  }
  const refreshed = Array.isArray(saved.data) ? saved.data.map(mapPortalEmployeeToUi) : []
  const found = refreshed.find((row) => row.id === code) || mapped
  return { success: true, data: found }
}

/**
 * Fields the backend actually writes on an *existing* employee via PUT /portal/employees.
 * See backend `app.services.hr._apply_portal(..., existing=True)` — all other portal keys are ignored.
 */
const PORTAL_EXISTING_WRITABLE = new Set(['department', 'role', 'reportingManager', 'status'])

function portalExistingUpdateWarning(submitted, persisted) {
  const ignored = []
  const check = [
    ['name', 'name'],
    ['email', 'email'],
    ['designation', 'designation'],
    ['contact', 'contact'],
    ['joiningDate', 'joiningDate'],
    ['employmentType', 'employmentType'],
    ['category', 'category'],
    ['grossSalary', 'grossSalary'],
    ['gender', 'gender'],
    ['address', 'address'],
    ['qualification', 'qualification'],
  ]
  for (const [key, label] of check) {
    const want = submitted?.[key]
    const got = persisted?.[key]
    if (want == null || want === '') continue
    if (String(want) !== String(got ?? '')) ignored.push(label)
  }
  if (!ignored.length) return null
  return (
    `Saved on server, but FastAPI only persists department / role / reportingManager / status ` +
    `for existing employees via PUT /portal/employees. Not applied: ${ignored.join(', ')}.`
  )
}

/**
 * Update one employee via PUT /portal/employees (backend replace semantics).
 * Always sends the full current portal list so other employees are not deactivated.
 */
export async function updateEmployee(employeeCode, form, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked

  const portal = await listPortalEmployees(options)
  if (!portal.success) return portal

  const code = employeeCode || form.id
  if (!portal.data.some((row) => row.id === code)) {
    return { success: false, error: `Employee ${code} was not found.`, data: null }
  }

  const portalRow = uiFormToPortalRow({ ...form, id: code }, code)
  const nextList = portal.data.map((row) => {
    if (row.id !== code) {
      return uiFormToPortalRow(row, row.id)
    }
    return portalRow
  })

  const saved = await apiClient.put('/api/v1/hr/portal/employees', nextList, { skipMock: true, ...options })
  if (!saved.success) return saved
  const refreshed = Array.isArray(saved.data) ? saved.data.map(mapPortalEmployeeToUi) : []
  const found = refreshed.find((row) => row.id === code) || portalRow
  const warning = portalExistingUpdateWarning(portalRow, found)
  // Annotate which keys the backend accepted so callers can be honest in the UI.
  return {
    success: true,
    data: found,
    warning: warning || undefined,
    writableOnExisting: [...PORTAL_EXISTING_WRITABLE],
  }
}

/** Activate / deactivate via portal PUT (status field). No hard delete endpoint. */
export async function setEmployeeStatus(employeeCode, status, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked

  const portal = await listPortalEmployees(options)
  if (!portal.success) return portal
  const current = portal.data.find((row) => row.id === employeeCode)
  if (!current) {
    return { success: false, error: `Employee ${employeeCode} was not found.`, data: null }
  }
  return updateEmployee(employeeCode, { ...current, status }, options)
}
