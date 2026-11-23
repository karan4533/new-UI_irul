/**
 * Class directory masters — FastAPI /api/v1/masters/*
 * Adapted from QMIS classDetailsApi for new-UI apiClient envelopes.
 */

import { mirrorApiClassDetails } from '../../Common/RBAC/academicsCatalogData.js'
import { apiClient } from './apiClient.js'
import { getAccessToken, isLiveApiEnabled } from './tokenStore.js'

export function canUseClassDetailsApi() {
  return isLiveApiEnabled() && Boolean(getAccessToken())
}

function unwrap(res, fallbackMessage = 'Request failed.') {
  if (!res?.success) {
    const err = new Error(typeof res?.error === 'string' ? res.error : fallbackMessage)
    err.status = res?.status || res?.meta?.status || 0
    throw err
  }
  return res.data
}

async function apiGet(path, params) {
  return unwrap(await apiClient.get(`/api/v1${path}`, { skipMock: true, params }), `GET ${path} failed`)
}

async function apiSend(method, path, body) {
  if (method === 'DELETE') {
    return unwrap(await apiClient.delete(`/api/v1${path}`, { skipMock: true }), `DELETE ${path} failed`)
  }
  const fn = method === 'POST' ? apiClient.post : method === 'PATCH' ? apiClient.patch : apiClient.put
  return unwrap(await fn.call(apiClient, `/api/v1${path}`, body ?? {}, { skipMock: true }), `${method} ${path} failed`)
}

const sortByNumberedName = (a, b) => a.localeCompare(b, undefined, { numeric: true })

const normalizeYear = (year) => ({
  id: year.id,
  name: year.name,
  isCurrent: Boolean(year.is_current),
  isActive: year.is_active !== false,
})

const normalizeSection = (section) => ({
  id: section.id,
  name: section.name,
  isActive: section.is_active !== false,
  capacity: section.capacity ?? null,
  roomNumber: section.room_number || '',
  classTeacherUserId: section.class_teacher_user_id || '',
  classTeacherName: section.class_teacher_name || section.class_teacher_email || '',
})

export async function loadClassDirectory({ academicYearId = '', includeInactive = false } = {}) {
  const classParams = {}
  if (academicYearId) classParams.academic_year_id = academicYearId
  if (includeInactive) classParams.include_inactive = 'true'

  const [years, classes, sections] = await Promise.all([
    apiGet('/masters/academic-years'),
    apiGet('/masters/classes', classParams),
    apiGet('/masters/sections', { include_inactive: 'true' }),
  ])

  const yearList = (Array.isArray(years) ? years : []).map(normalizeYear)
  const yearNameById = new Map(yearList.map((year) => [year.id, year.name]))
  const sectionsByClass = new Map()
  ;(Array.isArray(sections) ? sections : []).forEach((section) => {
    const list = sectionsByClass.get(section.class_id) || []
    list.push(normalizeSection(section))
    sectionsByClass.set(section.class_id, list)
  })

  const records = (Array.isArray(classes) ? classes : [])
    .map((item) => ({
      id: item.id,
      className: item.name,
      displayName: item.name,
      academicYearId: item.academic_year_id || '',
      academicYear: item.academic_year_id ? yearNameById.get(item.academic_year_id) || 'Unknown year' : '—',
      isActive: item.is_active !== false,
      capacity: item.capacity ?? null,
      sections: (sectionsByClass.get(item.id) || []).sort((a, b) => sortByNumberedName(a.name, b.name)),
    }))
    .sort((a, b) => sortByNumberedName(a.className, b.className))

  const filtered = Boolean(academicYearId) || includeInactive
  if (!filtered) {
    const currentYear = yearList.find((year) => year.isCurrent)
    const mirrored = records
      .filter((record) => record.isActive && (!currentYear || record.academicYearId === currentYear.id))
      .map((record) => ({
        ...record,
        sections: record.sections.filter((section) => section.isActive),
      }))
    mirrorApiClassDetails(mirrored)
  }
  return { years: yearList, records, filtered }
}

let hydratePromise = null
let catalogHydrated = false

export function refreshClassCatalog() {
  catalogHydrated = false
  hydratePromise = null
  return loadClassDirectory()
    .then((result) => {
      catalogHydrated = Boolean(result)
      return result
    })
    .catch(() => null)
}

export function ensureClassCatalogHydrated() {
  if (!canUseClassDetailsApi()) return Promise.resolve(null)
  if (catalogHydrated) return Promise.resolve(true)
  if (!hydratePromise) {
    hydratePromise = loadClassDirectory()
      .then((result) => {
        catalogHydrated = Boolean(result)
        return result
      })
      .catch(() => {
        catalogHydrated = false
        return null
      })
      .finally(() => {
        hydratePromise = null
      })
  }
  return hydratePromise
}

export async function listAcademicYears() {
  const rows = await apiGet('/masters/academic-years')
  return (Array.isArray(rows) ? rows : []).map(normalizeYear)
}

export async function loadClassTeacherOptions() {
  const rows = await apiGet('/masters/class-teacher-options')
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    userId: row.user_id,
    email: row.email,
    name: row.name || row.email,
    role: row.role,
  }))
}

export function parseCapacity(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return { value: null }
  if (!/^\d+$/.test(text)) return { message: 'Capacity must be a whole number.' }
  const value = Number(text)
  if (value < 1 || value > 1000) return { message: 'Capacity must be between 1 and 1000.' }
  return { value }
}

const cleanSectionNames = (sections) => {
  const seen = new Set()
  const names = []
  ;(sections || []).forEach((section) => {
    const name = String(typeof section === 'string' ? section : section?.name || '')
      .trim()
      .toUpperCase()
    if (name && !seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  })
  return names
}

const sectionBody = (section) => {
  const body = {}
  const capacity = parseCapacity(section.capacity)
  if (capacity.message) throw new Error(`Section ${String(section.name || '').toUpperCase()}: ${capacity.message}`)
  if (capacity.value !== null) body.capacity = capacity.value
  const room = String(section.roomNumber || '').trim()
  if (room) body.room_number = room
  if (section.classTeacherUserId) body.class_teacher_user_id = section.classTeacherUserId
  return body
}

export async function saveClassWithSections({ className, sections, academicYearId = '' }) {
  const name = String(className || '').trim()
  const sectionNames = cleanSectionNames(sections)
  if (!name) throw new Error('Class is required.')
  if (sectionNames.length === 0) throw new Error('Add at least one section.')

  const detailsByName = new Map()
  ;(sections || []).forEach((section) => {
    if (typeof section === 'string') return
    const key = String(section?.name || '').trim().toUpperCase()
    if (key && !detailsByName.has(key)) detailsByName.set(key, sectionBody(section))
  })

  let yearId = academicYearId
  if (!yearId) {
    const years = await apiGet('/masters/academic-years')
    const current = (Array.isArray(years) ? years : []).find((year) => year.is_current && year.is_active !== false)
    if (!current) throw new Error('There is no current academic year. Choose an academic year first.')
    yearId = current.id
  }

  const inYear = await apiGet('/masters/classes', {
    academic_year_id: yearId,
    include_inactive: 'true',
  })
  let target = (Array.isArray(inYear) ? inYear : []).find(
    (item) => String(item.name).toLowerCase() === name.toLowerCase(),
  )
  if (target && target.is_active === false) {
    throw new Error(
      `Class ${target.name} is deactivated in this academic year. Reactivate it from the class list, then add sections.`,
    )
  }

  const result = {
    classId: '',
    className: name,
    classCreated: false,
    sectionsCreated: [],
    sectionsExisting: [],
    failures: [],
  }

  if (!target) {
    target = await apiSend('POST', '/masters/classes', { name, academic_year_id: yearId })
    result.classCreated = true
  }
  result.classId = target.id
  result.className = target.name

  for (const sectionName of sectionNames) {
    try {
      await apiSend('POST', '/masters/sections', {
        class_id: target.id,
        name: sectionName,
        ...(detailsByName.get(sectionName) || {}),
      })
      result.sectionsCreated.push(sectionName)
    } catch (error) {
      if (error?.status === 409) result.sectionsExisting.push(sectionName)
      else result.failures.push({ name: sectionName, message: error.message || 'Request failed.' })
    }
  }

  await refreshClassCatalog()
  return result
}

export async function updateSectionDetails(sectionId, changes) {
  const body = {}
  if ('name' in changes) body.name = String(changes.name || '').trim()
  if ('isActive' in changes) body.is_active = Boolean(changes.isActive)
  if ('capacity' in changes) {
    const capacity = parseCapacity(changes.capacity)
    if (capacity.message) throw new Error(capacity.message)
    body.capacity = capacity.value
  }
  if ('roomNumber' in changes) body.room_number = String(changes.roomNumber || '').trim() || null
  if ('classTeacherUserId' in changes) body.class_teacher_user_id = changes.classTeacherUserId || null
  const saved = await apiSend('PATCH', `/masters/sections/${sectionId}`, body)
  await refreshClassCatalog()
  return saved
}

export async function addSectionToClass(classId, section) {
  const name = String(section?.name || '').trim().toUpperCase()
  if (!name) throw new Error('Section is required.')
  const saved = await apiSend('POST', '/masters/sections', {
    class_id: classId,
    name,
    ...sectionBody({ ...section, name }),
  })
  await refreshClassCatalog()
  return saved
}

export async function setClassActive(classId, isActive) {
  const saved = await apiSend('PATCH', `/masters/classes/${classId}`, { is_active: Boolean(isActive) })
  await refreshClassCatalog()
  return saved
}

export async function deleteClass(classId) {
  const deleted = await apiSend('DELETE', `/masters/classes/${classId}`, {})
  await refreshClassCatalog()
  return deleted
}
