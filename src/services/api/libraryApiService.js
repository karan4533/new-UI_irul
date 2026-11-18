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
