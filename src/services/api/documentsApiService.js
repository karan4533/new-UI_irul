/**
 * Live student / employee document folders — FastAPI /api/v1/documents/{kind}*.
 * kind: 'students' (ref = student UUID) | 'employees' (ref = employee code).
 * No mock fallback when live fails.
 */

import { apiClient } from './apiClient.js'
import { getAccessToken, isLiveApiEnabled } from './tokenStore.js'

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

const base = (kind) => `/api/v1/documents/${encodeURIComponent(kind)}`

export async function listDocumentFolders(kind, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get(base(kind), { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data : [] }
}

/** PUT /api/v1/documents/{kind}/{ref}/items (multipart). */
export async function putDocumentItem(kind, ref, { label, file, status, submittedDate }, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const form = new FormData()
  form.append('label', label)
  if (status) form.append('status', status)
  if (submittedDate) form.append('submitted_date', submittedDate)
  if (file) form.append('file', file)
  return apiClient.request('PUT', `${base(kind)}/${encodeURIComponent(ref)}/items`, form, { skipMock: true, ...options })
}

export async function deleteDocumentItem(kind, ref, itemId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.delete(`${base(kind)}/${encodeURIComponent(ref)}/items/${encodeURIComponent(itemId)}`, {
    skipMock: true,
    ...options,
  })
}

/** Authenticated download -> opens the file in a new tab via a blob URL. */
export async function openDocumentFile(downloadUrl) {
  const blocked = requireLive()
  if (blocked) return blocked
  try {
    const root = String(apiClient.baseUrl || '').replace(/\/$/, '')
    const url = /^https?:/i.test(downloadUrl) ? downloadUrl : `${root}${downloadUrl}`
    const token = getAccessToken()
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) return { success: false, error: `Download failed (${res.status}).`, data: null }
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    window.open(objectUrl, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    return { success: true, data: null, error: null }
  } catch (error) {
    return { success: false, error: error?.message || 'Download failed.', data: null }
  }
}
