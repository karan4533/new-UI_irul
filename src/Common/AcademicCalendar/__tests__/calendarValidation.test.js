import test from 'node:test'
import assert from 'node:assert/strict'

import { addCustomCalendarItem, validateCalendarDateRange } from '../academicCalendarData.js'
import { downloadCsv } from '../../utils/downloadCsv.js'

test('validateCalendarDateRange accepts equal start and end dates', () => {
    assert.deepEqual(validateCalendarDateRange({ startDate: '2026-11-20', endDate: '2026-11-20' }), {
        startDate: '2026-11-20',
        endDate: '2026-11-20',
    })
})

test('validateCalendarDateRange rejects end date before start date', () => {
    assert.throws(
        () => validateCalendarDateRange({ startDate: '2026-11-24', endDate: '2026-11-20' }),
        /End date must be on or after/
    )
})

test('validateCalendarDateRange rejects same-day end time before start time when not all-day', () => {
    assert.throws(
        () =>
            validateCalendarDateRange({
                startDate: '2026-11-20',
                endDate: '2026-11-20',
                startTime: '14:00',
                endTime: '13:00',
                allDay: false,
            }),
        /End time must be on or after/
    )
})

test('validateCalendarDateRange allows multi-day events without same-day time validation', () => {
    assert.deepEqual(
        validateCalendarDateRange({
            startDate: '2026-11-20',
            endDate: '2026-11-22',
            startTime: '14:00',
            endTime: '09:00',
            allDay: false,
        }),
        { startDate: '2026-11-20', endDate: '2026-11-22' }
    )
})

test('addCustomCalendarItem does not persist invalid inverted date ranges', () => {
    assert.throws(
        () =>
            addCustomCalendarItem({
                title: 'Bad range',
                type: 'event',
                startDate: '2026-11-24',
                endDate: '2026-11-20',
            }),
        /End date must be on or after/
    )
})

test('downloadCsv rejects empty headers', () => {
    assert.throws(() => downloadCsv('sample.csv', [], []), /at least one column header/)
})
