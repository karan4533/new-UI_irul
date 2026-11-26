import assert from 'node:assert/strict'
import test from 'node:test'
import {
    displayTcStatus,
    isTcWorkflowStepCurrent,
    resolveTcWorkflowStage,
} from '../tcRequestData.js'

test('resolveTcWorkflowStage prefers workflowStage over stale PRM status', () => {
    assert.equal(resolveTcWorkflowStage({ status: 'Pending PRM Review', workflowStage: 'coordinator' }), 'coordinator')
    assert.equal(resolveTcWorkflowStage({ status: 'Pending PRM Review', workflowStage: 'prm' }), 'prm')
    assert.equal(resolveTcWorkflowStage({ status: 'Pending Manager NOCs', workflowStage: 'class_teacher' }), 'noc')
    assert.equal(resolveTcWorkflowStage({ status: 'Pending Super Admin Approval' }), 'md')
    assert.equal(resolveTcWorkflowStage({ status: 'Approved', workflowStage: 'md' }), 'md')
})

test('displayTcStatus uses stage labels while API status is still PRM intake', () => {
    assert.equal(
        displayTcStatus({ status: 'Pending PRM Review', workflowStage: 'class_teacher' }),
        'Pending Class Teacher review',
    )
    assert.equal(
        displayTcStatus({ status: 'Pending PRM Review', workflowStage: 'prm' }),
        'Pending PRM Review',
    )
    assert.equal(
        displayTcStatus({ status: 'Pending Super Admin Approval', workflowStage: 'md' }),
        'Pending MD final (after NOCs)',
    )
    assert.equal(displayTcStatus({ status: 'Approved' }), 'TC issued (MD final)')
})

test('workflow highlighter does not map prm onto class_teacher', () => {
    const prm = { status: 'Pending PRM Review', workflowStage: 'prm' }
    assert.equal(isTcWorkflowStepCurrent('prm', prm), true)
    assert.equal(isTcWorkflowStepCurrent('class_teacher', prm), false)

    const ct = { status: 'Pending PRM Review', workflowStage: 'class_teacher' }
    assert.equal(isTcWorkflowStepCurrent('prm', ct), false)
    assert.equal(isTcWorkflowStepCurrent('class_teacher', ct), true)
})
