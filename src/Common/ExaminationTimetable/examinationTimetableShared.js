/**
 * Shared Examination Timetable SoT for Principal create/list and Director approvals.
 * Unifies previously separate Principal localStorage vs Director static arrays.
 *
 * LIVE backend persistence (VITE_USE_MOCK=false):
 * - Principal Published create → createExam + submitExam stores backend exam id + approvalId here.
 * - Director approve/deny calls decide when entry.approvalId is set; refresh uses listExams.
 * - Default seed rows (EXM001–EXM003) have no approvalId — Director actions stay localStorage-only
 *   unless syncSharedExamsFromLiveRows matches them to a live exam by the same id (UUID after submit).
 */

export const SHARED_EXAM_TIMETABLE_STORAGE_KEY = 'schoolerp-examination-timetables-v1'
export const LEGACY_PRINCIPAL_STORAGE_KEY = 'principal-examination-timetables'
export const EXAM_TIMETABLE_UPDATED_EVENT = 'schoolerp-exam-timetables-updated'

export const SUBMITTED_BY = 'Principal'
export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Denied']
export const EXAM_STATUSES = ['Draft', 'Published']

export const approvalStatusColor = {
    Approved: 'text-[#4CAF50] border-[#4CAF5033] bg-[#4CAF5014]',
    Pending: 'text-[#FF9800] border-[#FF980033] bg-[#FF980014]',
    Denied: 'text-[#980E0F] border-[#980E0F33] bg-[#980E0F14]',
}

export const examStatusColor = {
    Published: 'text-[#4CAF50] border-[#4CAF5033] bg-[#4CAF5014]',
    Draft: 'text-[#667085] border-[#66708533] bg-[#66708514]',
}

const DEFAULT_EXAM_TIMETABLES = [
    {
        id: 'EXM001',
        examName: 'Mid Term Examination',
        className: 'Grade 9',
        section: 'A',
        teacherName: 'Mr. Ravi Kumar',
        status: 'Published',
        startDate: '15-09-2025',
        endDate: '20-09-2025',
        createdDate: '01-09-2025',
        submittedBy: SUBMITTED_BY,
        submittedDate: '01-09-2025',
        approvalStatus: 'Pending',
        rejectionReason: '',
        timelines: [
            { id: 'TL-1', day: 'Monday', subject: 'Tamil', examDate: '02/05/2026', startTime: '10:30', endTime: '12:30' },
            { id: 'TL-2', day: 'Monday', subject: 'English', examDate: '02/05/2026', startTime: '14:30', endTime: '16:30' },
            { id: 'TL-3', day: 'Tuesday', subject: 'Science', examDate: '03/05/2026', startTime: '10:30', endTime: '12:30' },
            { id: 'TL-4', day: 'Wednesday', subject: 'Maths', examDate: '04/05/2026', startTime: '14:30', endTime: '16:30' },
        ],
    },
    {
        id: 'EXM002',
        examName: 'Annual Examination',
        className: 'Grade 10',
        section: 'B',
        teacherName: 'Ms. Anitha Verma',
        status: 'Published',
        startDate: '01-03-2026',
        endDate: '15-03-2026',
        createdDate: '10-02-2026',
        submittedBy: SUBMITTED_BY,
        submittedDate: '10-02-2026',
        approvalStatus: 'Approved',
        rejectionReason: '',
        timelines: [
            { id: 'TL-5', day: 'Monday', subject: 'Maths', examDate: '01/03/2026', startTime: '10:30', endTime: '12:30' },
            { id: 'TL-6', day: 'Tuesday', subject: 'Science', examDate: '02/03/2026', startTime: '10:30', endTime: '12:30' },
        ],
    },
    {
        id: 'EXM003',
        examName: 'Unit -4a',
        className: 'Grade 8',
        section: 'A',
        teacherName: 'Dr. Suresh Menon',
        status: 'Published',
        startDate: '05-11-2025',
        endDate: '08-11-2025',
        createdDate: '25-10-2025',
        submittedBy: SUBMITTED_BY,
        submittedDate: '25-10-2025',
        approvalStatus: 'Denied',
        rejectionReason: 'Subject slots overlap on Day 2. Please revise the Mathematics and Science schedule.',
        timelines: [
            { id: 'TL-7', day: 'Monday', subject: 'Tamil', examDate: '05/11/2025', startTime: '10:30', endTime: '12:30' },
            { id: 'TL-8', day: 'Tuesday', subject: 'Maths', examDate: '06/11/2025', startTime: '10:30', endTime: '12:30' },
        ],
    },
]

let _memoryExams = null

const notifyUpdated = () => {
    try {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(EXAM_TIMETABLE_UPDATED_EVENT))
        }
    } catch {
        /* ignore */
    }
}

const normalizeRecord = (item) => {
    if (!item) return null
    const className = item.className || ''
    const section = item.section || ''
    const classSection = item.classSection || (className && section ? `${className} - ${section}` : className || section || '')
    return {
        ...item,
        id: item.id,
        examName: item.examName || item.name || 'Assessment',
        className,
        section,
        classSection,
        teacherName: item.teacherName || '',
        status: item.status || 'Draft',
        startDate: item.startDate || '',
        endDate: item.endDate || '',
        createdDate: item.createdDate || item.submittedDate || '',
        submittedBy: item.submittedBy || SUBMITTED_BY,
        submittedDate: item.submittedDate || item.createdDate || '',
        approvalStatus: item.approvalStatus || 'Pending',
        rejectionReason: item.rejectionReason || '',
        approvalId: item.approvalId || null,
        timelines: Array.isArray(item.timelines) ? item.timelines : [],
        modalTitle: item.modalTitle || `${item.examName || item.name || 'Exam'} — ${classSection}`,
    }
}

export const saveExamTimetables = (records) => {
    const normalized = (Array.isArray(records) ? records : []).map(normalizeRecord).filter(Boolean)
    _memoryExams = normalized
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(SHARED_EXAM_TIMETABLE_STORAGE_KEY, JSON.stringify(normalized))
        }
    } catch {
        /* ignore */
    }
    notifyUpdated()
}

export const getExamTimetables = () => {
    if (_memoryExams && Array.isArray(_memoryExams) && _memoryExams.length > 0) {
        return _memoryExams.map(normalizeRecord)
    }
    try {
        if (typeof localStorage !== 'undefined') {
            const shared = localStorage.getItem(SHARED_EXAM_TIMETABLE_STORAGE_KEY)
            if (shared) {
                const parsed = JSON.parse(shared)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    _memoryExams = parsed.map(normalizeRecord)
                    return _memoryExams
                }
            }
            const legacy = localStorage.getItem(LEGACY_PRINCIPAL_STORAGE_KEY)
            if (legacy) {
                const parsed = JSON.parse(legacy)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const merged = parsed.map(normalizeRecord)
                    saveExamTimetables(merged)
                    return merged
                }
            }
        }
    } catch {
        /* ignore */
    }
    const seeded = DEFAULT_EXAM_TIMETABLES.map(normalizeRecord)
    saveExamTimetables(seeded)
    return seeded
}

export const getExamTimetableById = (id) =>
    getExamTimetables().find((item) => item.id === id) ?? null

export const getDirectorExamApprovals = () =>
    getExamTimetables()
        .filter((item) => item.status === 'Published' || item.approvalStatus)
        .map(normalizeRecord)

export const generateExamId = () => {
    const list = getExamTimetables()
    const max = list.reduce((acc, item) => {
        const num = Number(String(item.id || '').replace(/^EXM/i, ''))
        return Number.isFinite(num) ? Math.max(acc, num) : acc
    }, 0)
    return `EXM${String(max + 1).padStart(3, '0')}`
}

export const formatDisplayDate = (value) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    return value.toLocaleDateString('en-GB').replace(/\//g, '-')
}

export const addExamTimetable = (payload = {}) => {
    const timelines = Array.isArray(payload.timelines)
        ? payload.timelines.filter((row) => row && row.day && row.subject)
        : []
    const record = normalizeRecord({
        id: payload.examId || payload.id || generateExamId(),
        examName: payload.examName || 'Assessment',
        className: payload.className || '',
        section: payload.section || '',
        teacherName: payload.teacherName || '',
        status: payload.status || 'Draft',
        startDate: formatDisplayDate(payload.startDate),
        endDate: formatDisplayDate(payload.endDate),
        createdDate: formatDisplayDate(new Date()),
        submittedBy: SUBMITTED_BY,
        submittedDate: formatDisplayDate(new Date()),
        approvalStatus: payload.status === 'Published' ? 'Pending' : 'Pending',
        rejectionReason: '',
        timelines,
        approvalId: payload.approvalId || null,
    })
    saveExamTimetables([record, ...getExamTimetables().filter((r) => r.id !== record.id)])
    return record
}

/**
 * Patch shared local rows that share an id with live /api/v1/exams (e.g. after Principal submit).
 * Does not map seed EXM00x ids to backend UUIDs.
 */
export const syncSharedExamsFromLiveRows = (liveRows = []) => {
    if (!Array.isArray(liveRows) || liveRows.length === 0) return false
    const liveById = new Map(liveRows.map((row) => [String(row.id), row]))
    const list = getExamTimetables()
    let changed = false
    const next = list.map((item) => {
        const live = liveById.get(String(item.id))
        if (!live) return item
        const patches = {}
        if (live.approvalId && item.approvalId !== live.approvalId) {
            patches.approvalId = live.approvalId
        }
        if (live.approvalStatus && item.approvalStatus !== live.approvalStatus) {
            patches.approvalStatus = live.approvalStatus
        }
        if (live.approvalStatus === 'Denied' && live.rejectionReason !== undefined) {
            patches.rejectionReason = live.rejectionReason || item.rejectionReason || ''
        }
        if (Object.keys(patches).length === 0) return item
        changed = true
        return normalizeRecord({ ...item, ...patches })
    })
    if (changed) saveExamTimetables(next)
    return changed
}

export const updateExamApprovalStatus = (examId, approvalStatus, rejectionReason = '') => {
    const list = getExamTimetables()
    const index = list.findIndex((item) => item.id === examId)
    if (index === -1) {
        throw new Error(`Exam timetable ${examId} was not found.`)
    }
    const nextStatus = approvalStatus
    list[index] = normalizeRecord({
        ...list[index],
        approvalStatus: nextStatus,
        rejectionReason: nextStatus === 'Denied' ? rejectionReason : '',
        status: 'Published',
    })
    saveExamTimetables(list)
    return list[index]
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const buildExamGridFromTimelines = (timelines = []) => {
    const safeTimelines = Array.isArray(timelines) ? timelines.filter(Boolean) : []
    const days = [...new Set(safeTimelines.map((row) => row.day).filter(Boolean))]
    const slotMap = new Map()

    safeTimelines.forEach((row) => {
        if (!row || !row.startTime || !row.endTime) return
        const label = `${row.startTime} - ${row.endTime}`
        if (!slotMap.has(label)) {
            slotMap.set(label, {
                label,
                time: `${row.startTime} -\n${row.endTime}`,
            })
        }
    })

    const timeSlots = [...slotMap.values()]
    const schedule = {}

    safeTimelines.forEach((row) => {
        if (!row || !row.day || !row.startTime || !row.endTime || !row.subject) return
        const label = `${row.startTime} - ${row.endTime}`
        if (!schedule[label]) schedule[label] = {}
        schedule[label][row.day] = {
            subject: row.subject,
            date: row.examDate || '—',
        }
    })

    return {
        days: days.length ? days : DAYS.slice(0, 6),
        timeSlots: timeSlots.length ? timeSlots : [{ time: '—', label: '—' }],
        schedule,
    }
}

export const getClassSectionLabel = (record) =>
    record?.classSection || `${record?.className || ''} - ${record?.section || ''}`.replace(/ - $/, '')
