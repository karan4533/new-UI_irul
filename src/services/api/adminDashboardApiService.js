/**
 * Live admin dashboard KPIs — GET /api/v1/admin/dashboard
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

export async function getAdminDashboard(options = {}) {
  const blocked = requireLive()
  if (blocked) return blocked
  const res = await apiClient.get('/api/v1/admin/dashboard', { skipMock: true, ...options })
  if (!res.success) return res
  const raw = res.data || {}
  return {
    ...res,
    data: {
      students: Number(raw.students) || 0,
      employees: Number(raw.employees) || 0,
      leaveRequests: Number(raw.leaveRequests) || 0,
      openEscalations: Number(raw.openEscalations) || 0,
      pendingTc: Number(raw.pendingTc) || 0,
      unreadNotifications: Number(raw.unreadNotifications) || 0,
      announcementsThisMonth: Number(raw.announcementsThisMonth) || 0,
      asOf: raw.asOf || '',
    },
  }
}
