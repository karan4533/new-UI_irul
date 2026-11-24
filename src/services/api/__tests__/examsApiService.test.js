import assert from 'node:assert/strict'
import test from 'node:test'

const { mapExamToUi } = await import('../examsApiService.js')

test('mapExamToUi exposes approvalId and maps approved status', () => {
    const ui = mapExamToUi({
        id: 'exam-uuid-1',
        name: 'Unit Test',
        className: 'Grade 9 - A',
        startDate: '2026-03-01',
        endDate: '2026-03-05',
        status: 'approved',
        approvalId: 'approval-uuid-1',
        awaitingRole: 'director',
    })
    assert.equal(ui.id, 'exam-uuid-1')
    assert.equal(ui.approvalId, 'approval-uuid-1')
    assert.equal(ui.approvalStatus, 'Approved')
    assert.equal(ui.source, 'backend')
})

test('mapExamToUi pending submit uses Pending approvalStatus', () => {
    const ui = mapExamToUi({
        id: 'exam-uuid-2',
        name: 'Midterm',
        className: 'Grade 8 - A',
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        status: 'pending',
        approvalId: 'approval-uuid-2',
    })
    assert.equal(ui.approvalStatus, 'Pending')
    assert.equal(ui.approvalId, 'approval-uuid-2')
})