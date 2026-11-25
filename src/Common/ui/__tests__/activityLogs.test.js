import test from 'node:test'
import assert from 'node:assert/strict'

import {
    filterActivityLogs,
    formatLogValue,
    getCellValue,
    getActivityLogById,
    parseActivityTimestamp,
    resolveActivityBackRoute,
    resolvePreviousValue,
    resolveUpdatedValue,
} from '../../../Pages/SuperAdmin/ActivityLogs/activityLogsData.js'

const records = [
    { id: 'log-1', timestamp: '07-08-2026 11:22 PM', user: 'Asha', status: 'Blocked' },
    { id: 'log-2', timestamp: '08-08-2026 06:42 AM', user: 'Bilal', status: 'Failed' },
]

test('activity timestamps are parsed from stored day-month-year values', () => {
    assert.equal(parseActivityTimestamp(records[0].timestamp)?.toISOString(), '2026-08-07T23:22:00.000Z')
    assert.equal(parseActivityTimestamp('not-a-timestamp'), null)
})

test('activity filters combine search, status and inclusive dates', () => {
    assert.deepEqual(
        filterActivityLogs(records, {
            search: 'bilal',
            status: 'Failed',
            fromDate: '2026-08-08',
            toDate: '2026-08-08',
        }).map((record) => record.id),
        ['log-2'],
    )
})

test('activity filtering does not mutate source records', () => {
    const copy = structuredClone(records)
    filterActivityLogs(records, { fromDate: '2026-08-08' })
    assert.deepEqual(records, copy)
})

test('change summary never renders undefined for missing previous/updated values', () => {
    assert.equal(formatLogValue(undefined), '—')
    assert.equal(formatLogValue(null), '—')
    assert.equal(resolvePreviousValue({ previousValue: 'A' }), 'A')
    assert.equal(resolveUpdatedValue({ updatedValue: 'B' }), 'B')
    assert.equal(
        getCellValue(
            { oldValue: undefined, newValue: undefined },
            { key: 'changeSummary', computed: true },
        ),
        '— → —',
    )
    assert.equal(
        getCellValue(
            { oldValue: 'Pending', newValue: 'Confirmed' },
            { key: 'changeSummary', computed: true },
        ),
        'Pending → Confirmed',
    )
})

test('inspect back route preserves originating activity category', () => {
    assert.equal(resolveActivityBackRoute('data-changes'), '/super-admin/activity-logs/data-changes')
    assert.equal(resolveActivityBackRoute('deleted-records'), '/super-admin/activity-logs/deleted-records')
    assert.equal(resolveActivityBackRoute('demo-activity'), '/super-admin/activity-logs/demo-activity')
    assert.ok(getActivityLogById('log-dc-001')?.logType === 'data-changes')
    assert.ok(getActivityLogById('log-dr-001')?.logType === 'deleted-records')
})
