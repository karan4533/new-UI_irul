import { canUseAcademicsApi } from '../../../services/api/academicsApiService.js'
import { readAcademicsCollection } from '../../../services/api/academicsLiveCollection.js'

const LIVE_COLLECTION = 'class-timetables'

export const DEFAULT_TEACHER_TIMETABLE_INFO = {
    employeeId: 'TEA-1001',
    teacherName: 'Anita Verma',
    subject: 'Mathematics',
}

export const WEEKLY_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const DEFAULT_TIME_SLOTS = [
    { time: '09:00 AM -\n09:45 AM', label: '09:00 AM - 09:45 AM' },
    { time: '09:45 AM -\n10:30 AM', label: '09:45 AM - 10:30 AM' },
    { time: '10:45 AM -\n11:30 AM', label: '10:45 AM - 11:30 AM' },
    { time: '11:30 AM -\n12:15 PM', label: '11:30 AM - 12:15 PM' },
    { time: '01:15 PM -\n02:00 PM', label: '01:15 PM - 02:00 PM' },
]

export const DEFAULT_WEEKLY_SCHEDULE = {
    '09:00 AM - 09:45 AM': {
        Monday: { subject: 'Mathematics', className: '10-A' },
        Tuesday: { subject: 'Mathematics', className: '10-B' },
        Wednesday: { subject: 'Mathematics', className: '9-A' },
        Thursday: { subject: 'Mathematics', className: '10-A' },
        Friday: { subject: 'Mathematics', className: '11-A' },
        Saturday: { subject: 'Mathematics', className: '10-B' },
    },
    '09:45 AM - 10:30 AM': {
        Monday: { subject: 'Mathematics', className: '10-B' },
        Tuesday: { subject: 'Mathematics', className: '9-A' },
        Wednesday: { subject: 'Mathematics', className: '10-A' },
        Thursday: { subject: 'Mathematics', className: '11-A' },
        Friday: { subject: 'Mathematics', className: '10-B' },
        Saturday: null,
    },
    '10:45 AM - 11:30 AM': {
        Monday: { subject: 'Mathematics', className: '9-A' },
        Tuesday: { subject: 'Mathematics', className: '10-A' },
        Wednesday: { subject: 'Mathematics', className: '10-B' },
        Thursday: { subject: 'Mathematics', className: '9-A' },
        Friday: { subject: 'Mathematics', className: '10-A' },
        Saturday: { subject: 'Mathematics', className: '9-A' },
    },
    '11:30 AM - 12:15 PM': {
        Monday: { subject: 'Mathematics', className: '11-A' },
        Tuesday: null,
        Wednesday: { subject: 'Mathematics', className: '11-A' },
        Thursday: { subject: 'Mathematics', className: '10-B' },
        Friday: { subject: 'Mathematics', className: '9-A' },
        Saturday: null,
    },
    '01:15 PM - 02:00 PM': {
        Monday: null,
        Tuesday: { subject: 'Mathematics', className: '11-A' },
        Wednesday: null,
        Thursday: { subject: 'Mathematics', className: '10-A' },
        Friday: null,
        Saturday: { subject: 'Mathematics', className: '10-A' },
    },
}

export const SUBJECT_COLORS = {
    Mathematics: 'bg-blue-50 text-blue-700 border border-blue-100',
    Physics: 'bg-purple-50 text-purple-700 border border-purple-100',
    Chemistry: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    Biology: 'bg-teal-50 text-teal-700 border border-teal-100',
    English: 'bg-rose-50 text-rose-700 border border-rose-100',
    'Social Studies': 'bg-amber-50 text-amber-700 border border-amber-100',
    'Computer Science': 'bg-cyan-50 text-cyan-700 border border-cyan-100',
    'Hindi / Regional': 'bg-orange-50 text-orange-700 border border-orange-100',
    'Physical Education': 'bg-lime-50 text-lime-700 border border-lime-100',
    'Library & Reading': 'bg-indigo-50 text-indigo-700 border border-indigo-100',
    'Co-Curricular / Clubs': 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100',
}

export const DEFAULT_ALLOTTED_CLASS_INFO = {
    className: 'Class 10-A',
    classTeacher: 'Anita Verma',
    room: 'Room 304, Secondary Wing',
    totalStudents: 42,
    academicYear: '2026-27'
}

export const DEFAULT_ALLOTTED_CLASS_SCHEDULE = {
    '09:00 AM - 09:45 AM': {
        Monday: { subject: 'Mathematics', teacher: 'Anita Verma', room: '304' },
        Tuesday: { subject: 'English', teacher: 'Sandy Selva', room: '304' },
        Wednesday: { subject: 'Physics', teacher: 'Dr. Subramanian', room: 'Lab 2' },
        Thursday: { subject: 'Mathematics', teacher: 'Anita Verma', room: '304' },
        Friday: { subject: 'Chemistry', teacher: 'Ananya Roy', room: 'Lab 1' },
        Saturday: { subject: 'Social Studies', teacher: 'Priya Sharma', room: '304' },
    },
    '09:45 AM - 10:30 AM': {
        Monday: { subject: 'Physics', teacher: 'Dr. Subramanian', room: 'Lab 2' },
        Tuesday: { subject: 'Chemistry', teacher: 'Ananya Roy', room: 'Lab 1' },
        Wednesday: { subject: 'Mathematics', teacher: 'Anita Verma', room: '304' },
        Thursday: { subject: 'English', teacher: 'Sandy Selva', room: '304' },
        Friday: { subject: 'Biology', teacher: 'Dr. Anita Sen', room: 'Bio Lab' },
        Saturday: { subject: 'Physical Education', teacher: 'Coach Murugan', room: 'Playground' },
    },
    '10:45 AM - 11:30 AM': {
        Monday: { subject: 'Social Studies', teacher: 'Priya Sharma', room: '304' },
        Tuesday: { subject: 'Mathematics', teacher: 'Anita Verma', room: '304' },
        Wednesday: { subject: 'Computer Science', teacher: 'Rakesh Nair', room: 'IT Lab 1' },
        Thursday: { subject: 'Chemistry', teacher: 'Ananya Roy', room: 'Lab 1' },
        Friday: { subject: 'Mathematics', teacher: 'Anita Verma', room: '304' },
        Saturday: { subject: 'English', teacher: 'Sandy Selva', room: '304' },
    },
    '11:30 AM - 12:15 PM': {
        Monday: { subject: 'English', teacher: 'Sandy Selva', room: '304' },
        Tuesday: { subject: 'Social Studies', teacher: 'Priya Sharma', room: '304' },
        Wednesday: { subject: 'Hindi / Regional', teacher: 'Meena Kumari', room: '304' },
        Thursday: { subject: 'Computer Science', teacher: 'Rakesh Nair', room: 'IT Lab 1' },
        Friday: { subject: 'Physics', teacher: 'Dr. Subramanian', room: 'Lab 2' },
        Saturday: { subject: 'Library & Reading', teacher: 'Meenakshi Sundaram', room: 'Central Library' },
    },
    '01:15 PM - 02:00 PM': {
        Monday: { subject: 'Chemistry', teacher: 'Ananya Roy', room: 'Lab 1' },
        Tuesday: { subject: 'Physics', teacher: 'Dr. Subramanian', room: 'Lab 2' },
        Wednesday: { subject: 'Social Studies', teacher: 'Priya Sharma', room: '304' },
        Thursday: { subject: 'Mathematics', teacher: 'Anita Verma', room: '304' },
        Friday: { subject: 'Co-Curricular / Clubs', teacher: 'Club In-Charge', room: 'Activity Hall' },
        Saturday: { subject: 'Mathematics', teacher: 'Anita Verma', room: '304' },
    },
}

const EMPTY_TEACHER_INFO = { employeeId: '', teacherName: '', subject: '' }
const EMPTY_ALLOTTED_INFO = { className: '', classTeacher: '', room: '', totalStudents: 0, academicYear: '' }

/** Mock-only demo values; empty shells when live. */
export const getTeacherTimetableInfo = () => (canUseAcademicsApi() ? EMPTY_TEACHER_INFO : DEFAULT_TEACHER_TIMETABLE_INFO)
export const getAllottedClassInfo = () => (canUseAcademicsApi() ? EMPTY_ALLOTTED_INFO : DEFAULT_ALLOTTED_CLASS_INFO)

const toMinutes = (value) => {
    const text = String(value || '').trim()
    const match = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
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

const normalize = (value) => String(value || '').trim().toLowerCase()

const classLabelOf = (timetable, timeline) => {
    const className = String(timeline.className || timetable.className || '').replace(/^(grade|class)\s*/i, '').trim()
    const section = String(timeline.section || timetable.section || '').trim()
    return [className, section].filter(Boolean).join('-')
}

/**
 * Best-effort mapping of live /academics/class-timetables rows into the weekly grid shape.
 * Returns { timeSlots, schedule } — both empty when nothing matches.
 */
export const buildLiveWeeklyView = (timetables, { mode = 'teacher', teacherName = '', teacherEmail = '' } = {}) => {
    const nameKey = normalize(teacherName)
    const emailKey = normalize(teacherEmail)
    const slotMap = new Map()
    const schedule = {}

    ;(Array.isArray(timetables) ? timetables : []).forEach((timetable) => {
        const ownerMatches = (nameKey && normalize(timetable.ownerTeacherName) === nameKey)
            || (emailKey && normalize(timetable.ownerTeacherEmail) === emailKey)
        const timelines = Array.isArray(timetable.timelines) ? timetable.timelines : []
        timelines.forEach((timeline) => {
            if (!timeline || !timeline.day || !timeline.startTime || !timeline.endTime) return
            const teacherMatches = (nameKey && normalize(timeline.teacher) === nameKey)
                || (emailKey && normalize(timeline.teacherEmail) === emailKey)
            if (mode === 'teacher' ? !teacherMatches : !ownerMatches) return

            const start = to12Hour(timeline.startTime)
            const end = to12Hour(timeline.endTime)
            const label = `${start} - ${end}`
            if (!slotMap.has(label)) {
                slotMap.set(label, { time: `${start} -\n${end}`, label, sortKey: toMinutes(timeline.startTime) ?? 0 })
            }
            schedule[label] = schedule[label] || {}
            schedule[label][timeline.day] = {
                subject: timeline.subject || '',
                className: classLabelOf(timetable, timeline),
                teacher: timeline.teacher || '',
                room: timeline.room || '',
            }
        })
    })

    const timeSlots = [...slotMap.values()]
        .sort((a, b) => a.sortKey - b.sortKey)
        .map(({ time, label }) => ({ time, label }))
    return { timeSlots, schedule }
}

/** Live: readAcademicsCollection('class-timetables') mapped to a weekly view. Mock: demo grids. */
export const getWeeklyView = (mode, identity = {}) => {
    if (canUseAcademicsApi()) {
        return buildLiveWeeklyView(readAcademicsCollection(LIVE_COLLECTION), { mode, ...identity })
    }
    return {
        timeSlots: DEFAULT_TIME_SLOTS,
        schedule: mode === 'teacher' ? DEFAULT_WEEKLY_SCHEDULE : DEFAULT_ALLOTTED_CLASS_SCHEDULE,
    }
}
