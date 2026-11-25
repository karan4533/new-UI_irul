import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeDepartmentConfigForUi, normalizeTicketForUi } from '../departmentTicketingData.js'

test('normalizeTicketForUi maps SoT fields to UI aliases', () => {
    const ui = normalizeTicketForUi({
        id: 'TICK-2026-001',
        ticketTitle: 'Smartboard fault',
        issueCategory: 'Classroom Interactive Smartboard / Projector',
        requestedByName: 'Ananya Roy',
        requestingDepartment: 'Academics & Teaching',
        assignedToName: 'Rakesh Nair',
        slaHours: 12,
        status: 'Submitted',
    })
    assert.equal(ui.ticketNumber, 'TICK-2026-001')
    assert.equal(ui.title, 'Smartboard fault')
    assert.equal(ui.category, 'Classroom Interactive Smartboard / Projector')
    assert.equal(ui.raisedByName, 'Ananya Roy')
    assert.equal(ui.raisedByDepartment, 'Academics & Teaching')
    assert.equal(ui.assignedStaffName, 'Rakesh Nair')
    assert.equal(ui.slaHours, 12)
})

test('normalizeDepartmentConfigForUi exposes head and medium SLA hours', () => {
    const ui = normalizeDepartmentConfigForUi({
        name: 'IT Support & Systems',
        managerName: 'Rakesh Nair',
        slaTargetHours: { Critical: 4, High: 12, Medium: 24, Low: 48 },
    })
    assert.equal(ui.headOfDepartment, 'Rakesh Nair')
    assert.equal(ui.slaHours, 24)
})
