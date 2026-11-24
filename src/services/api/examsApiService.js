/**
 * Exams API — FastAPI /api/v1/exams* + approval decide for exam_timetable.
 * Used when VITE_USE_MOCK=false. No fake success without backend confirmation.
 */

import { apiClient } from './apiClient.js'
import { isLiveApiEnabled } from './tokenStore.js'
import { decideApproval } from './approvalsApiService.js'

function requireLive() {
    if (!isLiveApiEnabled()) {
        return {
            success: false,
            error: 'Live API is disabled. Set VITE_USE_MOCK=false and VITE_API_BASE_URL.',
            data: null,
        }
    }
    return null
}

function formatDisplayDate(iso) {
    if (!iso) return ''
    const date = new Date(`${iso}T00:00:00`)
    if (Number.isNaN(date.getTime())) return String(iso)
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const yyyy = date.getFullYear()
    return `${dd}-${mm}-${yyyy}`
}

function mapExamStatus(status) {
    const key = String(status || '').toLowerCase()
    if (key === 'approved') return 'Approved'
    if (key === 'denied' || key === 'rejected') return 'Denied'
    if (key === 'draft') return 'Draft'
    return 'Pending'
}

export function mapExamToUi(row = {}) {
    const approvalStatus = mapExamStatus(row.status)
    return {
        id: row.id || '',
        examId: row.id || '',
        examName: row.name || '',
        name: row.name || '',
        className: row.className || '',
        section: '',
        classSection: row.className || '',
        academicYear: row.academicYear || '',
        examType: row.examType || '',
        examTypeName: row.examTypeName || '',
        startDate: formatDisplayDate(row.startDate),
        endDate: formatDisplayDate(row.endDate),
        startDateIso: row.startDate || '',
        endDateIso: row.endDate || '',
        status: approvalStatus === 'Draft' ? 'Draft' : 'Published',
        approvalStatus: approvalStatus === 'Draft' ? 'Pending' : approvalStatus,
        approvalId: row.approvalId || null,
        awaitingRole: row.awaitingRole || null,
        submittedBy: 'Principal',
        submittedDate: formatDisplayDate(row.startDate),
        rejectionReason: '',
        timelines: [],
        source: 'backend',
        raw: row,
    }
}

export async function listExams(params = {}, options = {}) {
    const blocked = requireLive()
    if (blocked) return { ...blocked, data: [] }
    const res = await apiClient.get('/api/v1/exams', { params, skipMock: true, ...options })
    if (!res.success) return { ...res, data: [] }
    const rows = Array.isArray(res.data) ? res.data : []
    return { ...res, data: rows.map(mapExamToUi) }
}

export async function createExam(payload, options = {}) {
    const blocked = requireLive()
    if (blocked) return blocked
    const body = {
        name: payload.name || payload.examName,
        examType: payload.examType || 'MIDTERM',
        className: payload.className || payload.classSection,
        startDate: payload.startDateIso || payload.startDate,
        endDate: payload.endDateIso || payload.endDate || payload.startDateIso || payload.startDate,
        academicYear: payload.academicYear || null,
    }
    const res = await apiClient.post('/api/v1/exams', body, { skipMock: true, ...options })
    if (!res.success) return { ...res, data: null }
    return { ...res, data: mapExamToUi(res.data || {}) }
}

export async function submitExam(examId, options = {}) {
    const blocked = requireLive()
    if (blocked) return blocked
    if (!examId) return { success: false, error: 'Exam id is required.', data: null }
    const res = await apiClient.post(`/api/v1/exams/${examId}/submit`, {}, { skipMock: true, ...options })
    if (!res.success) return { ...res, data: null }
    return { ...res, data: mapExamToUi(res.data || {}) }
}

export async function decideExamApproval(approvalId, { decision, comment } = {}, options = {}) {
    return decideApproval(approvalId, { decision, comment }, options)
}

function gradeFromPercent(pct) {
    if (pct == null || Number.isNaN(Number(pct))) return '—'
    const value = Number(pct)
    if (value >= 90) return 'A1'
    if (value >= 80) return 'A2'
    if (value >= 70) return 'B1'
    if (value >= 60) return 'B2'
    if (value >= 50) return 'C1'
    if (value >= 40) return 'C2'
    return 'D'
}

/**
 * Map GET /api/v1/results/students/{id} into Exam Result list rows + summary.
 * One UI row per published subject within each exam.
 */
export function mapStudentResultsToUi(payload = {}) {
    const exams = Array.isArray(payload.exams) ? payload.exams : []
    const rows = []
    const numericPercents = []
    let highest = null

    exams.forEach((exam) => {
        const subjects = Array.isArray(exam.subjects) ? exam.subjects : []
        subjects.forEach((subject, index) => {
            const absent = Boolean(subject.absent)
            const maxMarks = Number(subject.maxMarks ?? 0)
            const marks = absent ? null : Number(subject.marks)
            const percent = !absent && maxMarks > 0 && marks != null
                ? Math.round((marks / maxMarks) * 1000) / 10
                : null
            if (percent != null) {
                numericPercents.push(percent)
                if (!highest || marks > highest.marks) {
                    highest = { marks, subject: subject.subject || '—', percent }
                }
            }
            rows.push({
                id: `${exam.examId || exam.examName || 'exam'}|${subject.subject || index}`,
                examName: exam.examName || exam.name || '—',
                subject: subject.subject || '—',
                term: exam.examType || '',
                academicYear: '',
                totalMarks: maxMarks || '—',
                obtainedMarks: absent ? '—' : (marks ?? '—'),
                grade: absent ? '—' : gradeFromPercent(percent),
                percentage: percent == null ? '—' : `${percent}%`,
                resultStatus: absent ? 'Absent' : (percent != null && percent < 40 ? 'Fail' : 'Pass'),
                teacherRemarks: '—',
                examDate: '',
                examId: exam.examId || '',
                rank: exam.rank ?? null,
                source: 'backend',
            })
        })
    })

    const averagePercent = numericPercents.length
        ? Math.round(numericPercents.reduce((sum, value) => sum + value, 0) / numericPercents.length)
        : null

    return {
        studentId: payload.studentId || '',
        studentName: payload.studentName || '',
        className: payload.className || '',
        rows,
        summary: {
            examAppeared: exams.length,
            averagePercent: averagePercent == null ? 0 : averagePercent,
            highestMark: highest ? highest.marks : '—',
            highestSubject: highest ? highest.subject : '—',
            overallGrade: averagePercent == null ? '—' : gradeFromPercent(averagePercent),
            hasData: rows.length > 0,
        },
    }
}

/** GET /api/v1/results/students/{studentId} — published results for parent/student. */
export async function getStudentResults(studentId, options = {}) {
    const blocked = requireLive()
    if (blocked) return { ...blocked, data: null }
    if (!studentId) return { success: false, error: 'Student id is required.', data: null }
    const res = await apiClient.get(
        `/api/v1/results/students/${encodeURIComponent(studentId)}`,
        { skipMock: true, ...options },
    )
    if (!res.success) return { ...res, data: null }
    return { ...res, data: mapStudentResultsToUi(res.data || {}) }
}
