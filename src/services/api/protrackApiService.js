/**
 * ProTrack365 GPS proxy — FastAPI /api/v1/protrack/*
 * Live bus positions for Transport Manager / Parent / Student.
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
  if (!getAccessToken()) {
    return { success: false, error: 'Sign in to load ProTrack365 GPS.', data: null }
  }
  return null
}

export const canUseProtrackApi = () => isLiveApiEnabled() && Boolean(getAccessToken())

export function datastatusLabel(code) {
  return (
    {
      1: 'Never online',
      2: 'Online',
      3: 'Expired',
      4: 'Offline',
      5: 'Blocked',
    }[Number(code)] || 'Unknown'
  )
}

export async function getProtrackStatus(options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  return apiClient.get('/api/v1/protrack/status', { skipMock: true, ...options })
}

export async function listProtrackDevices(panel, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const params = {}
  if (panel) params.panel = panel
  const res = await apiClient.get('/api/v1/protrack/devices', { skipMock: true, params, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data : [] }
}

export async function trackProtrackImeis(imeis, panel, options = {}) {
  const blocked = requireLive()
  if (blocked) return { ...blocked, data: [] }
  const list = Array.isArray(imeis) ? imeis.join(',') : String(imeis || '')
  const params = { imeis: list }
  if (panel) params.panel = panel
  const res = await apiClient.get('/api/v1/protrack/track', { skipMock: true, params, ...options })
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: Array.isArray(res.data) ? res.data : [] }
}
