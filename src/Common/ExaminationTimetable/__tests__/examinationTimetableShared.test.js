import test from 'node:test'
import assert from 'node:assert/strict'

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map()
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
    }
}

const {
    SHARED_EXAM_TIMETABLE_STORAGE_KEY,
    addExamTimetable,
    getDirectorExamApprovals,
    getExamTimetableById,
    getExamTimetables,
    saveExamTimetables,
    syncSharedExamsFromLiveRows,
    updateExamApprovalStatus,
} = await import('../examinationTimetableShared.js')

test('EXM003 shared SoT uses Unit -4a for Principal and Director', () => {
    localStorage.clear()
    saveExamTimetables([])
    const seeded = getExamTimetables()
    const exm003 = seeded.find((row) => row.id === 'EXM003')
    assert.ok(exm003)
    assert.equal(exm003.examName, 'Unit -4a')
    const directorRow = getDirectorExamApprovals().find((row) => row.id === 'EXM003')
    assert.equal(directorRow.examName, 'Unit -4a')
})

test('Principal published timetable appears in Director approval list', () => {
    localStorage.clear()
    saveExamTimetables([])
    getExamTimetables()
    const created = addExamTimetable({
        examName: 'Fresh Unit Assessment',
        className: 'Grade 7',
        section: 'B',
        status: 'Published',
        timelines: [
            { day: 'Monday', subject: 'Maths', examDate: '01/12/2026', startTime: '10:00', endTime: '11:00' },
        ],
    })
    const approvals = getDirectorExamApprovals()
    assert.ok(approvals.some((row) => row.id === created.id && row.examName === 'Fresh Unit Assessment'))
    assert.equal(getExamTimetableById(created.id)?.approvalStatus, 'Pending')
})

test('addExamTimetable stores approvalId from Principal live submit', () => {
    localStorage.clear()
    saveExamTimetables([])
    getExamTimetables()
    const backendId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const created = addExamTimetable({
        id: backendId,
        examId: backendId,
        examName: 'Live Midterm',
        className: 'Grade 9',
        section: 'A',
        status: 'Published',
        approvalId: 'appr-uuid-001',
        timelines: [
            { day: 'Monday', subject: 'Maths', examDate: '01/12/2026', startTime: '10:00', endTime: '11:00' },
        ],
    })
    assert.equal(created.approvalId, 'appr-uuid-001')
    assert.equal(getExamTimetableById(backendId)?.approvalId, 'appr-uuid-001')
})

test('syncSharedExamsFromLiveRows attaches approvalId and status by exam id', () => {
    localStorage.clear()
    saveExamTimetables([])
    getExamTimetables()
    const backendId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
    addExamTimetable({
        id: backendId,
        examId: backendId,
        examName: 'Pending Live Exam',
        className: 'Grade 10',
        section: 'B',
        status: 'Published',
        timelines: [
            { day: 'Tuesday', subject: 'Science', examDate: '02/12/2026', startTime: '10:00', endTime: '11:00' },
        ],
    })
    syncSharedExamsFromLiveRows([
        {
            id: backendId,
            approvalId: 'appr-sync-99',
            approvalStatus: 'Approved',
            rejectionReason: '',
        },
    ])
    const row = getExamTimetableById(backendId)
    assert.equal(row.approvalId, 'appr-sync-99')
    assert.equal(row.approvalStatus, 'Approved')
})

test('Director approval status persists across re-read', () => {
    localStorage.clear()
    saveExamTimetables([])
    getExamTimetables()
    updateExamApprovalStatus('EXM001', 'Approved')
    const stored = JSON.parse(localStorage.getItem(SHARED_EXAM_TIMETABLE_STORAGE_KEY) || '[]')
    const persisted = stored.find((row) => row.id === 'EXM001')
    assert.equal(persisted.approvalStatus, 'Approved')
    const again = getDirectorExamApprovals().find((row) => row.id === 'EXM001')
    assert.equal(again.approvalStatus, 'Approved')
})
