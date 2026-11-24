/**
 * W1 canonical role registry — aligns FE portal codes with backend matrix codes.
 * Does not grant privileges; only normalizes identifiers.
 */
import { ROLES, ROLE_HOME_PATHS, ROLE_PREFIX } from './roles.js'

/** FE portal role codes (from ROLES). */
export const FRONTEND_PORTAL_ROLES = Object.freeze(Object.values(ROLES))

/** Backend-only matrix roles (no dedicated FE ROLES entry). */
export const BACKEND_ONLY_ROLES = Object.freeze(['managing_director', 'finance_assistant'])

/** FE portals that lacked backend matrix registration before W1. */
export const W1_ALIGNED_PORTAL_ROLES = Object.freeze([
    'maintenancemanager',
    'pro',
    'fileroom',
    'cctv',
])

/** Legacy / alternate identifiers → canonical role code. */
export const ROLE_ALIASES = Object.freeze({
    vandriver: 'driver',
    'van-driver': 'driver',
    van_driver: 'driver',
    md: 'managing_director',
    managingdirector: 'managing_director',
    financeassistant: 'finance_assistant',
    account_head: 'accounthead',
    front_office: 'prm',
    frontoffice: 'prm',
})

export function normalizeRoleCode(code) {
    if (!code || typeof code !== 'string') return ''
    const cleaned = code.trim().toLowerCase().replace(/\s+/g, '')
    if (ROLE_ALIASES[cleaned]) return ROLE_ALIASES[cleaned]
    const compact = cleaned.replace(/[_-]/g, '')
    for (const [alias, canonical] of Object.entries(ROLE_ALIASES)) {
        if (alias.replace(/[_-]/g, '') === compact) return canonical
    }
    return cleaned
}

export function isFrontendPortalRole(code) {
    return FRONTEND_PORTAL_ROLES.includes(normalizeRoleCode(code))
}

export function getRoleHomePath(code) {
    const normalized = normalizeRoleCode(code)
    return ROLE_HOME_PATHS[normalized] || null
}

export function getRolePrefix(code) {
    const normalized = normalizeRoleCode(code)
    return ROLE_PREFIX[normalized] || null
}
