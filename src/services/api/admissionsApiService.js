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
  return {
    id: row.id,
    admissionCode: row.admission_code || row.admissionCode || '',
    admissionNumber: row.admission_code || row.admissionCode || '',
    enquiryId: row.enquiry_id || row.enquiryId || null,
    admissionDate: row.admission_date || row.admissionDate || '',
    className: row.class_name || row.className || '',
    registrationFees: row.registration_fees || row.registrationFees || '',
    firstName,
    middleName,
    lastName,
    name,
    gender: row.gender || '',
    mobileNumber: row.mobile_number || row.mobileNumber || '',
    email: row.email || '',
    city: row.city || '',
    state: row.state || '',
    status: row.status || 'Active',
    feesGroup: row.fees_group || row.feesGroup || '',
    enrolledStudentId: row.enrolled_student_id || row.enrolledStudentId || null,
    profileImage: row.profile_image_url || row.profileImageUrl || '',
    fatherName: row.father_name || row.fatherName || '',
    motherName: row.mother_name || row.motherName || '',
    createdAt: row.created_at || row.createdAt || '',
    createdDate: row.created_at || row.createdAt || '',
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
