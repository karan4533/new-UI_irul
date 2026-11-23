/**
 * Academics collections — FastAPI /api/v1/academics/*
 */

import { apiClient } from './apiClient.js'
import { getAccessToken, isLiveApiEnabled } from './tokenStore.js'

export function canUseAcademicsApi() {
  return isLiveApiEnabled() && Boolean(getAccessToken())
}

const enc = encodeURIComponent

function unwrap(res, fallbackMessage) {
  if (!res?.success) {
    const err = new Error(typeof res?.error === 'string' ? res.error : fallbackMessage)
    err.status = res?.status || res?.meta?.status || 0
    throw err
  }
  return res.data
}

export async function listAcademicsCollectionApi(collection, options = {}) {
  const res = await apiClient.get(`/api/v1/academics/${enc(collection)}`, {
    skipMock: true,
    ...options,
  })
  return unwrap(res, `Could not load ${collection}.`)
}

export async function replaceAcademicsCollectionApi(collection, items, options = {}) {
  const res = await apiClient.put(`/api/v1/academics/${enc(collection)}`, items, {
    skipMock: true,
    ...options,
  })
  return unwrap(res, `Could not save ${collection}.`)
}

export function stripAcademicsMeta(row) {
  if (!row || typeof row !== 'object') return row
  const next = { ...row }
  delete next._collection
  delete next._updatedAt
  delete next._createdAt
  return next
}
