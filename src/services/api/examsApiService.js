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
