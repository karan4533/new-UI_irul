/**
 * Live Admissions — FastAPI /api/v1/admissions*
 * Shared Admin / Front Office. No mock fallback when live fails.
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

export function mapEnquiryToUi(row = {}) {
  return {
    id: row.id,
    enquiryCode: row.enquiry_code || row.enquiryCode || '',
    name: row.name || '',
    mobileNumber: row.mobile_number || row.mobileNumber || '',
    email: row.email || '',
    gender: row.gender || '',
    address: row.address || '',
    description: row.description || '',
    note: row.note || '',
    enquiryDate: row.enquiry_date || row.enquiryDate || '',
    nextFollowUpDate: row.next_follow_up_date || row.nextFollowUpDate || '',
    assignedTo: row.assigned_to || row.assignedTo || '',
    reference: row.reference || '',
    source: row.source || '',
    className: row.class_name || row.className || '',
    numberOfChild: row.number_of_child || row.numberOfChild || '',
    city: row.city || '',
    state: row.state || '',
    profileImage: row.profile_image_url || row.profileImageUrl || '',
    status: row.status || 'Active',
    convertedAdmissionId: row.converted_admission_id || row.convertedAdmissionId || null,
    createdAt: row.created_at || row.createdAt || '',
    dataSource: 'backend',
  }
}

export function mapAdmissionToUi(row = {}) {
  const firstName = row.first_name || row.firstName || ''
  const middleName = row.middle_name || row.middleName || ''
  const lastName = row.last_name || row.lastName || ''
  const name = [firstName, middleName, lastName].filter(Boolean).join(' ')
  const createdAt = row.created_at || row.createdAt || ''
  return {
    id: row.id,
    admissionCode: row.admission_code || row.admissionCode || '',
    admissionNumber: row.admission_code || row.admissionCode || '',
    enquiryId: row.enquiry_id || row.enquiryId || null,
    fromEnquiryId: row.enquiry_id || row.enquiryId || null,
    admissionDate: row.admission_date || row.admissionDate || '',
    className: row.class_name || row.className || '',
    registrationFees: row.registration_fees || row.registrationFees || '',
    batchStartYear: row.batch_start_year ?? row.batchStartYear ?? '',
    batchEndYear: row.batch_end_year ?? row.batchEndYear ?? '',
    firstName,
    middleName,
    lastName,
    name,
    gender: row.gender || '',
    religion: row.religion || '',
    caste: row.caste || '',
    address: row.address || '',
    dateOfBirth: row.date_of_birth || row.dateOfBirth || '',
    country: row.country || '',
    state: row.state || '',
    city: row.city || '',
    zipCode: row.zip_code || row.zipCode || '',
    mobileNumber: row.mobile_number || row.mobileNumber || '',
    altMobileNumber: row.alt_mobile_number || row.altMobileNumber || '',
    email: row.email || '',
    previousSchool: row.previous_school || row.previousSchool || '',
    bloodGroup: row.blood_group || row.bloodGroup || '',
    height: row.height || '',
    weight: row.weight || '',
    medicalHistory: row.medical_history || row.medicalHistory || '',
    modeOfTransport: row.mode_of_transport || row.modeOfTransport || '',
    route: row.route || '',
    busStop: row.bus_stop || row.busStop || '',
    status: row.status || 'Active',
    feesGroup: row.fees_group || row.feesGroup || '',
    enrolledStudentId: row.enrolled_student_id || row.enrolledStudentId || null,
    enrolledAt: row.enrolled_at || row.enrolledAt || null,
    profileImage: row.profile_image_url || row.profileImageUrl || '',
    fatherName: row.father_name || row.fatherName || '',
    motherName: row.mother_name || row.motherName || '',
    fatherOccupation: row.father_occupation || row.fatherOccupation || '',
    motherOccupation: row.mother_occupation || row.motherOccupation || '',
    fatherIncome: row.father_income || row.fatherIncome || '',
    motherIncome: row.mother_income || row.motherIncome || '',
    siblings: row.siblings || '',
    parentAddress: row.parent_address || row.parentAddress || '',
    parentCountry: row.parent_country || row.parentCountry || '',
    parentState: row.parent_state || row.parentState || '',
    parentCity: row.parent_city || row.parentCity || '',
    parentZipCode: row.parent_zip_code || row.parentZipCode || '',
    parentMobileNumber: row.parent_mobile_number || row.parentMobileNumber || '',
    parentAltMobileNumber: row.parent_alt_mobile_number || row.parentAltMobileNumber || '',
    parentEmail: row.parent_email || row.parentEmail || '',
    parentAccountEmail: row.parent_account_email || row.parentAccountEmail || '',
    studentAccountEmail: row.student_account_email || row.studentAccountEmail || '',
    hasParentAccountPassword: Boolean(
      row.has_parent_account_password ?? row.hasParentAccountPassword,
    ),
    hasStudentAccountPassword: Boolean(
      row.has_student_account_password ?? row.hasStudentAccountPassword,
    ),
    createdAt,
    createdDate: typeof createdAt === 'string'
      ? createdAt.slice(0, 10)
      : (createdAt ? String(createdAt).slice(0, 10) : ''),
    dataSource: 'backend',
  }
}

export async function listAdmissionEnquiries(params = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const query = {}
  if (params.status) query.status = params.status
  const res = await apiClient.get('/api/v1/admissions/enquiries', { skipMock: true, params: query, ...options })
  if (!res.success) return res
  return { ...res, data: Array.isArray(res.data) ? res.data.map(mapEnquiryToUi) : [] }
}

export async function getAdmissionEnquiry(enquiryId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/admissions/enquiries/${encodeURIComponent(enquiryId)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapEnquiryToUi(res.data || {}) }
}

export async function createAdmissionEnquiry(payload, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const body = {
    name: payload.name || null,
    mobile_number: payload.mobileNumber || payload.mobile_number || null,
    email: payload.email || null,
    gender: payload.gender || null,
    address: payload.address || null,
    description: payload.description || null,
    note: payload.note || null,
    enquiry_date: payload.enquiryDate || payload.enquiry_date || null,
    next_follow_up_date: payload.nextFollowUpDate || payload.next_follow_up_date || null,
    assigned_to: payload.assignedTo || payload.assigned_to || null,
    reference: payload.reference || null,
    source: payload.source || null,
    class_name: payload.className || payload.class_name || '',
    number_of_child: payload.numberOfChild || payload.number_of_child || null,
    city: payload.city || null,
    state: payload.state || null,
    status: payload.status || 'Active',
  }
  const res = await apiClient.post('/api/v1/admissions/enquiries', body, { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: mapEnquiryToUi(res.data || {}) }
}

export async function updateAdmissionEnquiry(enquiryId, payload, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const body = {
    name: payload.name || null,
    mobile_number: payload.mobileNumber || payload.mobile_number || null,
    email: payload.email || null,
    gender: payload.gender || null,
    address: payload.address || null,
    description: payload.description || null,
    note: payload.note || null,
    enquiry_date: payload.enquiryDate || payload.enquiry_date || null,
    next_follow_up_date: payload.nextFollowUpDate || payload.next_follow_up_date || null,
    assigned_to: payload.assignedTo || payload.assigned_to || null,
    reference: payload.reference || null,
    source: payload.source || null,
    class_name: payload.className || payload.class_name || '',
    number_of_child: payload.numberOfChild || payload.number_of_child || null,
    city: payload.city || null,
    state: payload.state || null,
    status: payload.status || 'Active',
  }
  const res = await apiClient.patch(
    `/api/v1/admissions/enquiries/${encodeURIComponent(enquiryId)}`,
    body,
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapEnquiryToUi(res.data || {}) }
}

export async function listAdmissions(params = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const query = {}
  if (params.status) query.status = params.status
  const res = await apiClient.get('/api/v1/admissions', { skipMock: true, params: query, ...options })
  if (!res.success) return res
  return { ...res, data: Array.isArray(res.data) ? res.data.map(mapAdmissionToUi) : [] }
}

export async function getAdmission(admissionId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(`/api/v1/admissions/${encodeURIComponent(admissionId)}`, {
    skipMock: true,
    ...options,
  })
  if (!res.success) return res
  return { ...res, data: mapAdmissionToUi(res.data || {}) }
}

/** POST /api/v1/admissions/enquiries/{id}/convert */
export async function convertAdmissionEnquiry(enquiryId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(
    `/api/v1/admissions/enquiries/${encodeURIComponent(enquiryId)}/convert`,
    {},
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapAdmissionToUi(res.data || {}) }
}

/**
 * POST /api/v1/admissions/{id}/enroll
 * Places student on UIS/class only.
 * Client rules: no parent login; student portal created on Finance admission payment.
 */
export async function enrollAdmission(admissionId, payload = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  if (!admissionId) return { success: false, error: 'Admission id is required.', data: null }

  // Force-skip portal users at enrol (client Master Overview / Academics / Finance).
  const body = {
    parent_account_email: null,
    parent_account_password: null,
    skip_parent_account: true,
    student_account_email: null,
    student_account_password: null,
    skip_student_account: true,
  }
  void payload

  const res = await apiClient.post(
    `/api/v1/admissions/${encodeURIComponent(admissionId)}/enroll`,
    body,
    { skipMock: true, ...options },
  )
  if (!res.success) return { ...res, data: null }

  const raw = res.data || {}
  return {
    ...res,
    data: {
      admission: mapAdmissionToUi(raw.admission || {}),
      studentId: raw.student_id || raw.studentId || null,
      studentCode: raw.student_code || raw.studentCode || '',
      parentUserId: raw.parent_user_id || raw.parentUserId || null,
      parentCreated: Boolean(raw.parent_created ?? raw.parentCreated),
      studentUserId: raw.student_user_id || raw.studentUserId || null,
      studentCreated: Boolean(raw.student_created ?? raw.studentCreated),
    },
  }
}

function toIsoDate(value) {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/** Map UI enquiry form (camelCase / Date) → API create/update payload helpers already used by create/update. */
export function enquiryFormToApiPayload(form = {}) {
  return {
    name: form.name || form.studentName || '',
    mobileNumber: form.mobileNumber || form.guardianPhone || '',
    email: form.email || '',
    gender: form.gender || '',
    address: form.address || '',
    description: form.description || '',
    note: form.note || '',
    enquiryDate: toIsoDate(form.enquiryDate),
    nextFollowUpDate: toIsoDate(form.nextFollowUpDate),
    assignedTo: form.assignedTo || '',
    reference: form.reference || '',
    source: form.source || '',
    className: form.className || '',
    numberOfChild: form.numberOfChild || '',
    city: form.city || '',
    state: form.state || '',
    status: form.status || 'Active',
  }
}

function toOptionalYear(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return value.getFullYear()
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function emptyToNull(value) {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text : null
}

/** Map admission wizard form → AdmissionCreate body for POST/PATCH. */
export function admissionFormToApiPayload(form = {}) {
  const enquiryRaw = form.fromEnquiryId || form.enquiryId || null
  let enquiryId = null
  if (enquiryRaw) {
    const text = String(enquiryRaw).trim()
    // Only send UUID enquiry ids to the API
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
      enquiryId = text
    }
  }

  const status = form.status === 'Pending Finance Approval' ? 'Active' : (form.status || 'Active')

  return {
    enquiry_id: enquiryId,
    admission_date: toIsoDate(form.admissionDate),
    class_name: String(form.className || '').trim(),
    registration_fees: emptyToNull(form.registrationFees),
    batch_start_year: toOptionalYear(form.batchStartYear),
    batch_end_year: toOptionalYear(form.batchEndYear),
    first_name: String(form.firstName || '').trim(),
    middle_name: emptyToNull(form.middleName),
    last_name: emptyToNull(form.lastName),
    gender: emptyToNull(form.gender),
    religion: emptyToNull(form.religion),
    caste: emptyToNull(form.caste),
    address: emptyToNull(form.address),
    date_of_birth: toIsoDate(form.dateOfBirth),
    country: emptyToNull(form.country),
    state: emptyToNull(form.state),
    city: emptyToNull(form.city),
    zip_code: emptyToNull(form.zipCode),
    mobile_number: String(form.mobileNumber || '').trim(),
    alt_mobile_number: emptyToNull(form.altMobileNumber),
    email: emptyToNull(form.email),
    previous_school: emptyToNull(form.previousSchool),
    blood_group: emptyToNull(form.bloodGroup),
    height: emptyToNull(form.height),
    weight: emptyToNull(form.weight),
    medical_history: emptyToNull(form.medicalHistory),
    mode_of_transport: emptyToNull(form.modeOfTransport),
    route: emptyToNull(form.route),
    bus_stop: emptyToNull(form.busStop),
    father_name: emptyToNull(form.fatherName),
    mother_name: emptyToNull(form.motherName),
    father_occupation: emptyToNull(form.fatherOccupation),
    mother_occupation: emptyToNull(form.motherOccupation),
    father_income: emptyToNull(form.fatherIncome),
    mother_income: emptyToNull(form.motherIncome),
    siblings: emptyToNull(form.siblings),
    parent_address: emptyToNull(form.parentAddress),
    parent_country: emptyToNull(form.parentCountry),
    parent_state: emptyToNull(form.parentState),
    parent_city: emptyToNull(form.parentCity),
    parent_zip_code: emptyToNull(form.parentZipCode),
    parent_mobile_number: emptyToNull(form.parentMobileNumber),
    parent_alt_mobile_number: emptyToNull(form.parentAltMobileNumber),
    parent_email: emptyToNull(form.parentEmail),
    parent_account_email: (() => {
      const value = emptyToNull(form.parentAccountEmail)
      return value ? value.toLowerCase() : null
    })(),
    parent_account_password: emptyToNull(form.parentAccountPassword),
    student_account_email: (() => {
      const value = emptyToNull(form.studentAccountEmail)
      return value ? value.toLowerCase() : null
    })(),
    student_account_password: emptyToNull(form.studentAccountPassword),
    fees_group: emptyToNull(form.feesGroup),
    status,
  }
}

/** POST /api/v1/admissions */
export async function createAdmissionRecord(form, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const body = admissionFormToApiPayload(form)
  if (!body.first_name) return { success: false, error: 'First name is required.', data: null }
  if (!body.mobile_number) return { success: false, error: 'Mobile number is required.', data: null }
  if (!body.class_name) return { success: false, error: 'Class is required.', data: null }
  const res = await apiClient.post('/api/v1/admissions', body, { skipMock: true, ...options })
  if (!res.success) return { ...res, data: null }
  return { ...res, data: mapAdmissionToUi(res.data || {}) }
}

/** PATCH /api/v1/admissions/{id} */
export async function updateAdmissionRecord(admissionId, form, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  if (!admissionId) return { success: false, error: 'Admission id is required.', data: null }
  const body = admissionFormToApiPayload(form)
  if (!body.first_name) return { success: false, error: 'First name is required.', data: null }
  if (!body.mobile_number) return { success: false, error: 'Mobile number is required.', data: null }
  if (!body.class_name) return { success: false, error: 'Class is required.', data: null }
  const res = await apiClient.patch(
    `/api/v1/admissions/${encodeURIComponent(admissionId)}`,
    body,
    { skipMock: true, ...options },
  )
  if (!res.success) return { ...res, data: null }
  return { ...res, data: mapAdmissionToUi(res.data || {}) }
}
