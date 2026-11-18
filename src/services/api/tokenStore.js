/**
 * JWT token storage for live backend auth.
 * Session-scoped by default; mirrored to localStorage when "Remember me" is on.
 */

const TOKEN_SESSION_KEY = 'schoolerp_access_token'
const TOKEN_PERSISTENT_KEY = 'schoolerp_access_token_persistent'

export function getAccessToken() {
  try {
    return (
      sessionStorage.getItem(TOKEN_SESSION_KEY) ||
      localStorage.getItem(TOKEN_PERSISTENT_KEY) ||
      ''
    )
  } catch {
    return ''
  }
}

export function setAccessToken(token, rememberMe = false) {
  const value = token || ''
  try {
    if (!value) {
      clearAccessToken()
      return
    }
    sessionStorage.setItem(TOKEN_SESSION_KEY, value)
    if (rememberMe) {
      localStorage.setItem(TOKEN_PERSISTENT_KEY, value)
    } else {
      localStorage.removeItem(TOKEN_PERSISTENT_KEY)
    }
  } catch {
    // ignore storage failures
  }
}

export function clearAccessToken() {
  try {
    sessionStorage.removeItem(TOKEN_SESSION_KEY)
    localStorage.removeItem(TOKEN_PERSISTENT_KEY)
  } catch {
    // ignore
  }
}

export function isLiveApiEnabled() {
  if (typeof import.meta === 'undefined') return false
  const base = import.meta.env?.VITE_API_BASE_URL
  const useMock = import.meta.env?.VITE_USE_MOCK
  return Boolean(base) && useMock === 'false'
}
