/**
 * Signed-in staff profile — FastAPI GET/PATCH /api/v1/auth/me
 * Password change — POST /api/v1/auth/change-password
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

export function mapMeToProfileUi(me = {}) {
  const profile = me.profile || {}
  const details = profile.details || {}
  const name =
    profile.name ||
    me.name ||
    [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ') ||
    (me.email ? String(me.email).split('@')[0] : 'Staff User')

  return {
    id: me.id != null ? String(me.id) : '',
    email: me.email || '',
    role: me.role || '',
    roleLabel: me.role_name || me.role || '',
    isActive: me.is_active !== false,
    staffCode: profile.staffCode || me.staff_code || me.employee_code || '',
    employeeId: profile.staffCode || me.employee_code || me.staff_code || '',
    name,
    firstName: profile.firstName || '',
    middleName: profile.middleName || '',
    lastName: profile.lastName || '',
    gender: profile.gender || details.gender || '',
    mobileNumber: profile.mobileNumber || '',
    department: profile.department || me.department || me.campus?.name || '',
    designation: profile.designation || me.designation || me.role_name || '',
    joiningDate: profile.joiningDate || details.joiningDate || '',
    reportingManager: profile.reportingManager || details.reportingManager || '',
    employmentType: profile.employmentType || details.employmentType || '',
    status: profile.status || (me.is_active === false ? 'Inactive' : 'Active'),
    campus: me.campus || null,
    dateOfBirth: details.dateOfBirth || '',
    bloodGroup: details.bloodGroup || '',
    nationality: details.nationality || '',
    languages: details.languages || '',
    personalEmail: details.personalEmail || '',
    emergencyContact: details.familyContactNumber || details.emergencyContact || '',
    street: details.street || '',
    city: details.city || '',
    state: details.state || '',
    country: details.country || '',
    pincode: details.pincode || '',
    permanentAddress: details.permanentAddress || '',
    currentAddress: details.currentAddress || '',
    qualification: details.qualification || '',
    yearsOfExperience: details.yearsOfExperience || '',
    previousSchool: details.previousSchool || '',
    details,
    permissions: me.permissions || [],
    mustChangePassword: Boolean(me.must_change_password),
    source: 'backend',
  }
}

export async function getMyProfile(options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get('/api/v1/auth/me', { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: mapMeToProfileUi(res.data || {}) }
}

export async function updateMyProfile(changes = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const payload = {
    firstName: changes.firstName,
    middleName: changes.middleName,
    lastName: changes.lastName,
    gender: changes.gender,
    mobileNumber: changes.mobileNumber,
    details: {
      dateOfBirth: changes.dateOfBirth,
      bloodGroup: changes.bloodGroup,
      nationality: changes.nationality,
      languages: changes.languages,
      personalEmail: changes.personalEmail,
      familyContactNumber: changes.emergencyContact,
      emergencyContact: changes.emergencyContact,
      street: changes.street,
      city: changes.city,
      state: changes.state,
      country: changes.country,
      pincode: changes.pincode,
      permanentAddress: changes.permanentAddress,
      currentAddress: changes.currentAddress,
      qualification: changes.qualification,
      yearsOfExperience: changes.yearsOfExperience,
      previousSchool: changes.previousSchool,
      joiningDate: changes.joiningDate,
      reportingManager: changes.reportingManager,
      employmentType: changes.employmentType,
      department: changes.department,
      ...(changes.details || {}),
    },
  }
  const res = await apiClient.patch('/api/v1/auth/me', payload, { skipMock: true, ...options })
  if (!res.success) return res
  return { ...res, data: mapMeToProfileUi(res.data || {}) }
}

export async function changeMyPassword(currentPassword, newPassword, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.post(
    '/api/v1/auth/change-password',
    { current_password: currentPassword, new_password: newPassword },
    { skipMock: true, ...options },
  )
}
