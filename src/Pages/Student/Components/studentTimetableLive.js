import { canUseAcademicsApi } from '../../../services/api/academicsApiService.js'
import { readAcademicsCollection } from '../../../services/api/academicsLiveCollection.js'

/** Student timetable read-model over live academics `class-timetables` (no demo seeds). */
export const STUDENT_TIMETABLE_COLLECTION = 'class-timetables'

const normalize = (value) => String(value || '').trim().toLowerCase()
const stripGrade = (value) => String(value || '').replace(/^(grade|class)\s*/i, '').trim().toLowerCase()

const toMinutes = (value) => {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
    if (!match) return null
    let hours = Number(match[1])
    const minutes = Number(match[2])
    const meridiem = match[3]?.toUpperCase()
    if (meridiem === 'PM' && hours < 12) hours += 12
    if (meridiem === 'AM' && hours === 12) hours = 0
    return hours * 60 + minutes
}

const to12Hour = (value) => {
    const total = toMinutes(value)
    if (total === null) return String(value || '')
    const hours24 = Math.floor(total / 60)
    const minutes = total % 60
    const meridiem = hours24 >= 12 ? 'PM' : 'AM'
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
    return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${meridiem}`
}

/** Student identity → class/section when the auth user carries it (otherwise null = trust API scoping). */
export const resolveStudentClass = (user) => {
    const className = user?.className || user?.class || user?.grade || ''
    const section = user?.section || ''
    if (!className && !section) return null
    return { className: stripGrade(className), section: normalize(section) }
}

const timetableMatches = (timetable, studentClass) => {
    const status = normalize(timetable.approvalStatus)
    if (status && status !== 'approved') return false
    if (!studentClass) return true
    if (studentClass.className && stripGrade(timetable.className) !== studentClass.className) return false
    if (studentClass.section && normalize(timetable.section) !== studentClass.section) return false
    return true
}

export const buildStudentWeeklyView = (timetables, studentClass = null) => {
    const slotMap = new Map()
    const schedule = {}
    ;(Array.isArray(timetables) ? timetables : []).forEach((timetable) => {
        if (!timetableMatches(timetable, studentClass)) return
        const timelines = Array.isArray(timetable.timelines) ? timetable.timelines : []
        timelines.forEach((timeline) => {
            if (!timeline?.day || !timeline.startTime || !timeline.endTime) return
            const start = to12Hour(timeline.startTime)
            const end = to12Hour(timeline.endTime)
            const label = `${start} - ${end}`
            if (!slotMap.has(label)) {
                slotMap.set(label, { time: `${start} -\n${end}`, label, sortKey: toMinutes(timeline.startTime) ?? 0 })
            }
            schedule[label] = schedule[label] || {}
            schedule[label][timeline.day] = {
                subject: timeline.subject || '',
                teacher: timeline.teacher || '',
                period: timeline.periodNumber || '',
            }
        })
    })
    const timeSlots = [...slotMap.values()]
        .sort((a, b) => a.sortKey - b.sortKey)
        .map(({ time, label }) => ({ time, label }))
    return { timeSlots, schedule }
}

/** Live: weekly view from hydrated `class-timetables`; null in mock mode. */
export const getLiveStudentWeeklyView = (user) => {
    if (!canUseAcademicsApi()) return null
    return buildStudentWeeklyView(readAcademicsCollection(STUDENT_TIMETABLE_COLLECTION), resolveStudentClass(user))
}

/** Rows for a single weekday ("Monday"…) derived from a weekly view. */
export const dailyRowsFromWeeklyView = (view, dayName) => {
    if (!view) return []
    return view.timeSlots
        .map((slot, index) => {
            const period = view.schedule[slot.label]?.[dayName]
            if (!period?.subject) return null
            return {
                period: String(period.period || index + 1),
                time: slot.label,
                subject: period.subject,
                teacher: period.teacher || '—',
            }
        })
        .filter(Boolean)
}
