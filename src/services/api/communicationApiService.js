/**
 * Direct messaging — FastAPI /api/v1/communication/*
 * Live only. No mock/localStorage fallback when the API fails.
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

function buildAttachmentUrl(path) {
  if (!path) return '#'
  const token = getAccessToken()
  return apiClient.buildUrl(path, token ? { token } : {})
}

export function mapContactToUi(row = {}) {
  return {
    id: String(row.id || ''),
    name: row.name || 'Unknown user',
    employeeId: row.employeeId || '',
    role: row.role || '',
    department: row.department || '',
    avatarColor: row.avatarColor || '#515DEF',
  }
}

export function mapMessageToUi(row = {}) {
  const attachment = row.attachment
    ? {
        name: row.attachment.name || 'attachment',
        type: row.attachment.type || 'application/octet-stream',
        size: row.attachment.size || '',
        url: buildAttachmentUrl(row.attachment.url),
      }
    : undefined
  return {
    id: String(row.id || ''),
    senderId: String(row.senderId || ''),
    type: row.type || 'text',
    content: row.content || '',
    createdAt: row.createdAt || new Date().toISOString(),
    status: row.status || 'delivered',
    ...(attachment ? { attachment } : {}),
  }
}

export function mapConversationToUi(row = {}) {
  return {
    id: String(row.id || ''),
    participant: row.participant ? mapContactToUi(row.participant) : mapContactToUi({ name: 'Unknown user' }),
    lastMessage: row.lastMessage || '',
    lastMessageAt: row.lastMessageAt || new Date().toISOString(),
    unreadCount: Number(row.unreadCount) || 0,
    archived: Boolean(row.archived),
    deleted: Boolean(row.deleted),
    messages: Array.isArray(row.messages) ? row.messages.map(mapMessageToUi) : [],
  }
}

export async function listCommunicationDirectory(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/communication/directory', { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data.map(mapContactToUi) : [] }
}

export async function listConversations(options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const res = await apiClient.get('/api/v1/communication/conversations', { skipMock: true, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data.map(mapConversationToUi) : [] }
}

export async function getConversation(conversationId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get(
    `/api/v1/communication/conversations/${encodeURIComponent(conversationId)}`,
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapConversationToUi(res.data || {}) }
}

export async function startConversation(userId, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.post(
    '/api/v1/communication/conversations',
    { userId },
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapConversationToUi(res.data || {}) }
}

/**
 * Send one message (text and/or a single file) in an existing conversation.
 * @param {string} conversationId
 * @param {{ text?: string, file?: File|null }} payload
 */
export async function sendConversationMessage(conversationId, payload = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const form = new FormData()
  form.append('body', payload.text || '')
  if (payload.file instanceof File || payload.file instanceof Blob) {
    form.append('file', payload.file, payload.file.name || 'attachment')
  }
  const res = await apiClient.post(
    `/api/v1/communication/conversations/${encodeURIComponent(conversationId)}/messages`,
    form,
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapMessageToUi(res.data || {}) }
}

export async function setConversationFlags(conversationId, flags = {}, options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const body = {}
  if (flags.archived !== undefined) body.archived = Boolean(flags.archived)
  if (flags.deleted !== undefined) body.deleted = Boolean(flags.deleted)
  const res = await apiClient.patch(
    `/api/v1/communication/conversations/${encodeURIComponent(conversationId)}`,
    body,
    { skipMock: true, ...options },
  )
  if (!res.success) return res
  return { ...res, data: mapConversationToUi(res.data || {}) }
}
