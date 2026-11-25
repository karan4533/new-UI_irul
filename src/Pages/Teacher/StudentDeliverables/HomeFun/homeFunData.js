import { CLASSES, SECTIONS, SUBJECTS } from '../../AssignedClass/assignedClassData.js'
import { SUBMISSIONS_LIST } from './homeFunSubmissionsData.js'
import { getStoredSubmissions } from '../../../Student/StudentDeliverables/studentHomeFunSubmissions.js'
import { canUseAcademicsApi } from '../../../../services/api/academicsApiService.js'
import { readAcademicsCollection, writeAcademicsCollection } from '../../../../services/api/academicsLiveCollection.js'

const LIVE_COLLECTION = 'home-fun'

const STORAGE_KEY = 'teacher-home-fun-deliverables'

export const DEFAULT_ROUTE_BASE = '/teacher/student-deliverables/home-fun'

export const ASSESSMENT_TYPES = ['Assignment', 'Homework']

export const DELIVERABLE_TYPES = ASSESSMENT_TYPES

export const ASSIGNMENT_STATUSES = ['Active', 'In-Process', 'Completed']

export const statusBadgeColor = {
    Active: 'bg-[#4CAF5033] text-[#4CAF50]',
    'In-Process': 'bg-[#2196F333] text-[#2196F3]',
    Completed: 'bg-[#515DEF33] text-[#515DEF]',
}

export const typeBadgeColor = {
    Assignment: 'bg-[#515DEF33] text-[#515DEF]',
    Homework: 'bg-[#FF980033] text-[#FF9800]',
}

const parseListDate = (value) => {
    if (!value) return null
    const [day, month, year] = value.split('-').map(Number)
    if (!day || !month || !year) return null
    return new Date(year, month - 1, day)
}

export const getHomeFunItems = () => {
    if (canUseAcademicsApi()) {
        return readAcademicsCollection(LIVE_COLLECTION) // [] until hydrated
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) return JSON.parse(stored)
    } catch {
        /* ignore */
    }
    return []
}

export const saveHomeFunItems = (items) => {
    if (canUseAcademicsApi()) {
        writeAcademicsCollection(LIVE_COLLECTION, items)
        return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export const getRecordAssessmentType = (record) =>
    record.assessmentType ?? record.deliverableType ?? 'Assignment'

export const getHomeFunItemById = (id) =>
    getHomeFunItems().find((item) => item.id === id) ?? null

export const getHomeFunSubmissionRecord = (record) => {
    if (!record) return null

    const classSection = `${record.className || '10'}-${record.section || 'A'}`
    const live = canUseAcademicsApi()
    const matched = live ? null : SUBMISSIONS_LIST.find(
        (item) =>
            item.assignmentId === record.assignmentId
            || item.assignmentTitle === record.assignmentTitle,
    )

    const baseDetails = record.studentDetails ?? matched?.studentDetails ?? { submitted: [], pending: [], late: [] }
    const submittedList = [...(baseDetails.submitted || [])]
    const pendingList = [...(baseDetails.pending || [])]
    const lateList = [...(baseDetails.late || [])]

    // Merge live stored student submissions
    const stored = (live ? [] : getStoredSubmissions()).filter(
        (sub) => (record.assignmentId && sub.assignmentId === record.assignmentId) ||
                 (record.assignmentTitle && sub.assignmentTitle === record.assignmentTitle)
    )

    stored.forEach((sub) => {
        const studentId = sub.studentId
        const isLate = Boolean(sub.isLate)
        const targetList = isLate ? lateList : submittedList

        const existingIdx = targetList.findIndex((s) => s.id === studentId)
        const submissionObj = {
            id: studentId,
            name: sub.studentName || 'Aarav Sharma',
            rollNumber: sub.rollNumber || '10-A-01',
            admissionNumber: sub.admissionNumber || 'ADM-2024-1042',
            profile: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80',
            email: 'aarav.sharma@schoolerp.edu',
            submittedAt: sub.submittedAt || 'Today',
            isLate,
            status: sub.status || (isLate ? 'Late' : 'Submitted'),
            grade: sub.grade || null,
            marks: sub.marks || null,
            feedback: sub.feedback || null,
            submission: {
                fileName: sub.fileName || 'Assignment-Submission.pdf',
                fileSize: sub.fileSize || '850 KB',
                additionalNote: sub.additionalNote || '',
            },
        }

        if (existingIdx !== -1) {
            targetList[existingIdx] = submissionObj
        } else {
            targetList.push(submissionObj)
            const pIdx = pendingList.findIndex((s) => s.id === studentId)
            if (pIdx !== -1) pendingList.splice(pIdx, 1)
        }
    })

    const submittedCount = submittedList.length
    const lateCount = lateList.length
    const pendingCount = pendingList.length
    const totalStudents = record.totalStudents ?? matched?.totalStudents ?? Math.max(submittedCount + lateCount + pendingCount, 1)

    return {
        ...record,
        classSection,
        totalStudents,
        submittedStudents: submittedCount,
        pendingStudents: pendingCount,
        lateSubmissions: lateCount,
        studentDetails: {
            submitted: submittedList,
            pending: pendingList,
            late: lateList,
        },
    }
}

export const formatTotalSubmissions = (record) => {
    const submission = getHomeFunSubmissionRecord(record)
    if (!submission) return '—'
    return `${submission.submittedStudents}/${submission.totalStudents}`
}

export const addHomeFunItem = (item) => {
    const list = getHomeFunItems()
    const nextId = list.length + 1
    const record = {
        id: `HF-${1000 + nextId}`,
        assignmentId: `HF-${1000 + nextId}`,
        status: 'Active',
        ...item,
    }
    const next = [...list, record]
    saveHomeFunItems(next)
    return record
}

export const filterHomeFunItems = (items, filters) => {
    const search = filters.search.trim().toLowerCase()
    const fromDate = filters.fromDate
    const toDate = filters.toDate

    return items.filter((record) => {
        if (filters.type) {
            if (getRecordAssessmentType(record) !== filters.type) return false
        }
        if (filters.subject && record.subject !== filters.subject) return false
        if (filters.className && record.className !== filters.className) return false
        if (filters.section && record.section !== filters.section) return false
        if (filters.status && record.status !== filters.status) return false

        if (search) {
            const haystack = `${record.assignmentId} ${record.assignmentTitle} ${record.assignmentDescription}`.toLowerCase()
            if (!haystack.includes(search)) return false
        }

        const assigned = parseListDate(record.assignedDate)
        if (fromDate && assigned) {
            const start = new Date(fromDate)
            start.setHours(0, 0, 0, 0)
            if (assigned < start) return false
        }
        if (toDate && assigned) {
            const end = new Date(toDate)
            end.setHours(23, 59, 59, 999)
            if (assigned > end) return false
        }

        return true
    })
}

export { CLASSES, SECTIONS, SUBJECTS }
