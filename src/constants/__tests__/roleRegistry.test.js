import test from 'node:test'
import assert from 'node:assert/strict'

import { ROLES, ROLE_HOME_PATHS, ROLE_PREFIX } from '../roles.js'
import {
    BACKEND_ONLY_ROLES,
    FRONTEND_PORTAL_ROLES,
    W1_ALIGNED_PORTAL_ROLES,
    getRoleHomePath,
    getRolePrefix,
    isFrontendPortalRole,
    normalizeRoleCode,
} from '../roleRegistry.js'

test('W1 portal roles are present in ROLES and FRONTEND_PORTAL_ROLES', () => {
    for (const code of W1_ALIGNED_PORTAL_ROLES) {
        assert.ok(Object.values(ROLES).includes(code), `${code} missing from ROLES`)
        assert.ok(FRONTEND_PORTAL_ROLES.includes(code), `${code} missing from registry`)
    }
})

test('normalizeRoleCode maps legacy aliases without inventing privileges', () => {
    assert.equal(normalizeRoleCode('front_office'), 'prm')
    assert.equal(normalizeRoleCode('FrontOffice'), 'prm')
    assert.equal(normalizeRoleCode('van_driver'), 'driver')
    assert.equal(normalizeRoleCode('md'), 'managing_director')
    assert.equal(normalizeRoleCode('account_head'), 'accounthead')
    assert.equal(normalizeRoleCode('prm'), 'prm')
    assert.equal(normalizeRoleCode(''), '')
    assert.equal(normalizeRoleCode(null), '')
})

test('backend-only roles remain outside FE portal ROLES', () => {
    for (const code of BACKEND_ONLY_ROLES) {
        assert.equal(isFrontendPortalRole(code), false)
        assert.equal(getRoleHomePath(code), null)
        assert.equal(getRolePrefix(code), null)
    }
})

test('getRoleHomePath / getRolePrefix respect normalized aliases', () => {
    assert.equal(getRoleHomePath('front_office'), ROLE_HOME_PATHS[ROLES.PRM])
    assert.equal(getRolePrefix('van_driver'), ROLE_PREFIX[ROLES.DRIVER])
    assert.equal(getRoleHomePath('fileroom'), ROLE_HOME_PATHS[ROLES.FILE_ROOM])
})
