/**
 * Librarian campus library collections — FastAPI /api/v1/ops/library-*
 * Persistence is full-collection PUT (ops.replace). No mock fallback when live fails.
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

export function mapBookToUi(row = {}) {
  const total = Number(row.totalCopies ?? row.copies ?? 1) || 1
  const available = Number(
    row.availableCopies ?? (row.status === 'Available' ? total : row.availableCopies ?? 0),
  )
  return {
    id: row.id || '',
    title: row.title || '',
    author: row.author || '',
    isbn: row.isbn || '',
    publisher: row.publisher || '',
    category: row.category || '',
    shelf: row.shelf || '',
    totalCopies: total,
    availableCopies: Number.isFinite(available) ? available : total,
    price: Number(row.price) || 0,
    status: row.status || (available > 0 ? 'Available' : 'Unavailable'),
    source: 'backend',
  }
}

export function mapIssueToUi(row = {}) {
  return {
    id: row.id || '',
    bookId: row.bookId || '',
    bookTitle: row.bookTitle || row.title || '',
    author: row.author || '',
    memberId: row.memberId || '',
    memberName: row.memberName || '',
    memberType: row.memberType || row.role || '',
    admissionNumber: row.admissionNumber || '',
    issuedDate: row.issuedDate || '',
    dueDate: row.dueDate || row.returnDateDue || '',
    returnDate: row.returnDate || null,
    status: row.status || 'Issued',
    daysOverdue: Number(row.daysOverdue) || 0,
    lateFee: Number(row.lateFee) || 0,
    returnComment: row.returnComment || '',
    source: 'backend',
  }
}

export function mapMemberToUi(row = {}) {
  return {
    id: row.id || '',
    name: row.name || '',
    memberType: row.memberType || row.role || 'Student',
    role: row.role || row.memberType || 'Student',
    classSection: row.classSection || '',
    admissionNumber: row.admissionNumber || row.id || '',
    email: row.email || '',
    currentlyBorrowedCount: Number(row.currentlyBorrowedCount) || 0,
    maxBorrowLimit: Number(row.maxBorrowLimit) || (String(row.memberType || row.role || '').toLowerCase().includes('student') ? 1 : 5),
    source: 'backend',
  }
}

async function listCollection(path, mapper, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get(path, { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  const rows = Array.isArray(res.data) ? res.data.map(mapper) : []
  return { ...res, data: rows }
}

async function replaceCollection(path, rows, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const body = Array.isArray(rows) ? rows : []
  const res = await apiClient.put(path, body, { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data : body }
}

export function listLibraryBooks(options = {}) {
  return listCollection('/api/v1/ops/library-books', mapBookToUi, options)
}

export function replaceLibraryBooks(rows, options = {}) {
  return replaceCollection('/api/v1/ops/library-books', rows, options)
}

/** Alias used by some call sites / docs. */
export const saveLibraryBooks = replaceLibraryBooks

export function listLibraryIssues(options = {}) {
  return listCollection('/api/v1/ops/library-issues', mapIssueToUi, options)
}

export function replaceLibraryIssues(rows, options = {}) {
  return replaceCollection('/api/v1/ops/library-issues', rows, options)
}

export function listLibraryMembers(options = {}) {
  return listCollection('/api/v1/ops/library-members', mapMemberToUi, options)
}

export function replaceLibraryMembers(rows, options = {}) {
  return replaceCollection('/api/v1/ops/library-members', rows, options)
}

export function mapRequestToUi(row = {}) {
  return {
    id: row.id || '',
    bookTitle: row.bookTitle || row.title || '',
    title: row.bookTitle || row.title || '',
    author: row.author || '',
    isbn: row.isbn || '',
    category: row.category || row.department || 'General',
    requesterId: row.requesterId || row.memberId || '',
    requesterName: row.requesterName || row.requestedBy || '',
    requestedBy: row.requestedBy || row.requesterName || '',
    requesterType: row.requesterType || row.requestedByRole || 'Staff',
    requestedByRole: row.requestedByRole || row.requesterType || 'Staff',
    memberId: row.memberId || row.requesterId || '',
    classSection: row.classSection || '',
    department: row.department || row.category || '',
    purpose: row.purpose || row.reason || '',
    reason: row.reason || row.purpose || '',
    priority: row.priority || 'Standard',
    requestDate: row.requestDate || '',
    status: row.status || 'Pending Review',
    adminRemarks: row.adminRemarks || row.librarianRemarks || '',
    librarianRemarks: row.librarianRemarks || row.adminRemarks || '',
    source: 'backend',
  }
}

export function listLibraryRequests(options = {}) {
  return listCollection('/api/v1/ops/library-requests', mapRequestToUi, options)
}

export function replaceLibraryRequests(rows, options = {}) {
  return replaceCollection('/api/v1/ops/library-requests', rows, options)
}

export async function upsertLibraryRequest(row, options = {}) {
  const listed = await listLibraryRequests(options)
  if (!listed.success) return listed
  const rows = Array.isArray(listed.data) ? [...listed.data] : []
  const next = mapRequestToUi(row)
  if (!next.id) next.id = `LRQ-${String(rows.length + 1).padStart(4, '0')}`
  const idx = rows.findIndex((item) => String(item.id) === String(next.id))
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next }
  else rows.unshift(next)
  const saved = await replaceLibraryRequests(rows, options)
  if (!saved.success) return saved
  const mapped = (saved.data || []).map(mapRequestToUi)
  return {
    ...saved,
    data: mapped.find((item) => String(item.id) === String(next.id)) || next,
    rows: mapped,
  }
}

/** Load all three library collections for the workspace (sequential to avoid flaky parallel fetch). */
export async function loadLibraryWorkspace() {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: { books: [], issues: [], members: [] } }

  const books = await listLibraryBooks()
  if (!books.success) {
    return {
      success: false,
      error: books.error || 'Failed to load library books.',
      data: { books: [], issues: [], members: [] },
    }
  }
  const issues = await listLibraryIssues()
  if (!issues.success) {
    return {
      success: false,
      error: issues.error || 'Failed to load library issues.',
      data: { books: books.data, issues: [], members: [] },
    }
  }
  const members = await listLibraryMembers()
  if (!members.success) {
    return {
      success: false,
      error: members.error || 'Failed to load library members.',
      data: { books: books.data, issues: issues.data, members: [] },
    }
  }
  return {
    success: true,
    data: {
      books: books.data,
      issues: issues.data,
      members: members.data,
    },
  }
}
