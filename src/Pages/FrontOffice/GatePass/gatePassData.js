/**
 * Front Office Student Gate Pass Data Layer
 * Fully synchronized with Enterprise Gate Pass & Security Engine
 */

import {
    getStudentGatePasses as getUnifiedStudentGatePasses,
    saveStudentGatePasses,
    getStudentGatePassById as getUnifiedStudentGatePassById,
    createStudentGatePassRequest,
    filterStudentGatePasses as filterUnifiedStudentGatePasses,
    cancelStudentGatePass,
    getAvailableStudents,
    hydrateStudentGatePassesFromApi,
    STUDENT_GATE_PASS_STATUSES
} from '../../../Common/GatePassSecurity/gatePassSecurityData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listStudents } from '../../../services/api/studentApiService'
import { isRecordImmutable } from '../../../Common/ui/immutableRecords'

export const STATUS_OPTIONS = [
    'Pending Approval',
    'Approved',
    'Ready for Exit',
    'Exit Recorded',
    'Returned',
    'Rejected',
    'Cancelled'
]

export const statusBadgeColor = {
    'Pending': 'bg-amber-50 text-amber-700 border-amber-200',
    'Pending Approval': 'bg-amber-50 text-amber-700 border-amber-200',
    'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Ready for Exit': 'bg-blue-50 text-blue-700 border-blue-200',
    'Exit Recorded': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Returned': 'bg-slate-100 text-slate-700 border-slate-300',
    'Rejected': 'bg-rose-50 text-rose-700 border-rose-200',
    'Cancelled': 'bg-gray-100 text-gray-500 border-gray-200',
    'Overdue': 'bg-red-50 text-red-700 border-red-300',
    'Overdue Return': 'bg-red-50 text-red-700 border-red-300'
}

/** Client rule: requester chooses approvers (Class Teacher is always included). */
export const GATE_PASS_APPROVER_OPTIONS = [
    { value: 'class_teacher', label: 'Class Teacher (required)', fixed: true },
    { value: 'coordinator', label: 'Coordinator' },
    { value: 'principal', label: 'Principal' },
    { value: 'director', label: 'Director of Academics' },
    { value: 'prm', label: 'PRM / Front Office' },
    { value: 'hostel_warden', label: 'Hostel Warden' },
]

export const DEFAULT_GATE_PASS_FORM = {
    studentId: '',
    studentName: '',
    classSection: '',
    department: 'Academics - Secondary',
    gender: '',
    mobileNumber: '',
    city: '',
    reason: '',
    date: '',
    outTime: '11:00 AM',
    expectedDepartureTime: '11:00 AM',
    expectedReturnTime: '03:00 PM',
    accompanyingPerson: '',
    parentGuardianInfo: '',
    remarks: '',
    selectedApprovers: ['class_teacher', 'principal'],
    securityVerifyRequired: true,
    status: 'Pending Approval',
    profileImage: '',
}

export const formatGatePassDate = (date) => {
    if (!date) return ''
    const value = date instanceof Date ? date : new Date(date)
    if (Number.isNaN(value.getTime())) return ''
    const day = String(value.getDate()).padStart(2, '0')
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const year = value.getFullYear()
    return `${day}-${month}-${year}`
}

export const parseGatePassDate = (value) => {
    if (!value) return new Date()
    if (value instanceof Date) return value
    const parts = String(value).split('-').map(Number)
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        // DD-MM-YYYY
        return new Date(parts[2], parts[1] - 1, parts[0])
    }
    return new Date()
}

export const formatOutTimeForDisplay = (value) => {
    if (!value) return '—'
    if (/^\d{2}:\d{2}$/.test(value)) {
        const [hours, minutes] = value.split(':').map(Number)
        const period = hours >= 12 ? 'PM' : 'AM'
        const hour12 = hours % 12 || 12
        return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
    }
    return value
}

export const parseOutTimeForInput = (value) => {
    if (!value) return ''
    if (/^\d{2}:\d{2}$/.test(value)) return value

    const match = String(value).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
    if (!match) return ''

    let hours = Number(match[1])
    const minutes = match[2]
    const period = (match[3] || 'AM').toUpperCase()
    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0
    return `${String(hours).padStart(2, '0')}:${minutes}`
}

/** Normalize a live /students row or local directory row into gate-pass picker shape. */
export const toGatePassStudent = (row = {}) => {
    const studentId = row.studentId || row.id || row.admissionNumber || ''
    const studentName = row.studentName || row.name
        || [row.firstName, row.lastName].filter(Boolean).join(' ').trim()
        || 'Student'
    const classSection = row.classSection
        || [row.className, row.section].filter(Boolean).join('-')
        || row.className
        || ''
    return {
        studentId: String(studentId),
        studentName,
        classSection,
        admissionNumber: row.admissionNumber || '',
        department: row.department || 'Academics - Secondary',
        gender: row.gender || '',
        mobileNumber: row.mobileNumber || '',
        city: row.city || '',
        parentName: row.parentName || 'Parent',
        parentPhone: row.parentPhone || row.mobileNumber || '',
    }
}

export const getEnrolledStudentSelectOptions = (students = null) => {
    const list = Array.isArray(students) ? students : getAvailableStudents()
    return list.map((s) => {
        const student = toGatePassStudent(s)
        const idLabel = student.admissionNumber || student.studentId
        return {
            value: student.studentId,
            label: `${idLabel} — ${student.studentName} (${student.classSection || 'Class TBA'})`,
            student,
        }
    })
}

/**
 * Live SoT: enrolled admissions appear here via GET /api/v1/students.
 * Demo mode keeps the local/default directory.
 */
export const loadEnrolledStudentsForGatePass = async () => {
    if (!isLiveApiEnabled()) {
        const students = getAvailableStudents().map(toGatePassStudent)
        return { success: true, source: 'local', students, error: '' }
    }
    const res = await listStudents()
    if (!res.success) {
        return {
            success: false,
            source: 'error',
            students: [],
            error: typeof res.error === 'string' ? res.error : 'Failed to load enrolled students.',
        }
    }
    const students = (Array.isArray(res.data) ? res.data : []).map(toGatePassStudent)
    return { success: true, source: 'backend', students, error: '' }
}

export const mapStudentForGatePass = (studentId, students = null) => {
    const list = Array.isArray(students) ? students.map(toGatePassStudent) : getAvailableStudents().map(toGatePassStudent)
    const student = list.find((s) => s.studentId === studentId || s.admissionNumber === studentId)
    if (!student) return null

    return {
        studentId: student.studentId,
        studentName: student.studentName,
        classSection: student.classSection,
        department: student.department || 'Academics - Secondary',
        gender: student.gender,
        mobileNumber: student.mobileNumber,
        city: student.city,
        parentGuardianInfo: `${student.parentName || 'Parent'} (${student.parentPhone || student.mobileNumber || '—'})`,
        accompanyingPerson: student.parentName || 'Parent',
        profileImage: '',
    }
}

export const getStudentGatePasses = () => getUnifiedStudentGatePasses()

export const getStudentGatePassById = (id) => getUnifiedStudentGatePassById(id)

export const addStudentGatePass = async (payload) => {
    try {
        const selectedApprovers = Array.isArray(payload.selectedApprovers) && payload.selectedApprovers.length
            ? payload.selectedApprovers
            : ['class_teacher', 'principal']
        if (!selectedApprovers.includes('class_teacher')) {
            selectedApprovers.unshift('class_teacher')
        }
        if (isLiveApiEnabled()) {
            await hydrateStudentGatePassesFromApi({ force: true }).catch(() => null)
        }
        const result = await createStudentGatePassRequest({
            studentId: payload.studentId,
            studentName: payload.studentName,
            classSection: payload.classSection,
            department: payload.department,
            reason: payload.reason,
            date: payload.date,
            expectedDepartureTime: payload.expectedDepartureTime || payload.outTime,
            expectedReturnTime: payload.expectedReturnTime || '04:00 PM',
            accompanyingPerson: payload.accompanyingPerson,
            parentGuardianInfo: payload.parentGuardianInfo,
            remarks: payload.remarks,
            selectedApprovers,
            securityVerifyRequired: payload.securityVerifyRequired !== false,
            requesterName: 'Kavita Reddy (PRM / Front Office)',
            requesterRole: 'prm'
        })
        return { success: true, record: result }
    } catch (err) {
        return { success: false, message: err?.message || 'Failed to submit gate pass.' }
    }
}

export const updateStudentGatePass = (id, payload) => {
    const passes = getUnifiedStudentGatePasses()
    const idx = passes.findIndex((p) => p.id === id || p.gatePassId === id)
    if (idx < 0) return { success: false, message: 'Gate pass not found.' }

    const current = passes[idx]
    if (isRecordImmutable(current, { statusKeys: ['status', 'finalStatus', 'principalApproval'] })) {
        return {
            success: false,
            message: 'Client rule: gate passes cannot be edited after approval / Security verify. Create a new dated pass if needed.',
        }
    }

    passes[idx] = {
        ...passes[idx],
        ...payload,
        updatedAt: new Date().toISOString()
    }
    saveStudentGatePasses(passes)
    return { success: true, record: passes[idx] }
}

export const deleteStudentGatePass = (id) => {
    try {
        cancelStudentGatePass(id, 'Kavita Reddy (PRM)')
        return { success: true }
    } catch (err) {
        return { success: false, message: err.message }
    }
}

export const filterStudentGatePasses = (records, filters) =>
    filterUnifiedStudentGatePasses(records, filters)

export const toGatePassFormState = (record) => ({
    ...DEFAULT_GATE_PASS_FORM,
    studentId: record?.studentId || '',
    studentName: record?.studentName || '',
    classSection: record?.classSection || '',
    department: record?.department || 'Academics - Secondary',
    gender: record?.gender || '',
    mobileNumber: record?.mobileNumber || '',
    city: record?.city || '',
    reason: record?.reason || '',
    date: record?.date || '',
    outTime: record?.expectedDepartureTime || record?.outTime || '11:00 AM',
    expectedDepartureTime: record?.expectedDepartureTime || record?.outTime || '11:00 AM',
    expectedReturnTime: record?.expectedReturnTime || '03:00 PM',
    accompanyingPerson: record?.accompanyingPerson || '',
    parentGuardianInfo: record?.parentGuardianInfo || '',
    remarks: record?.remarks || '',
    selectedApprovers: Array.isArray(record?.selectedApprovers) && record.selectedApprovers.length
        ? record.selectedApprovers
        : ['class_teacher', 'principal'],
    securityVerifyRequired: record?.securityVerifyRequired !== false,
    status: record?.status || 'Pending Approval',
    profileImage: record?.profileImage || '',
})

export const validateStudentGatePassForm = (formData) => {
    const errors = {}
    if (!formData.studentId) errors.studentId = 'Select a student.'
    if (!String(formData.reason || '').trim()) errors.reason = 'Reason is required.'
    if (!formData.date) errors.date = 'Date is required.'
    if (!String(formData.expectedDepartureTime || formData.outTime || '').trim()) {
        errors.expectedDepartureTime = 'Departure time is required.'
    }
    if (!String(formData.expectedReturnTime || '').trim()) {
        errors.expectedReturnTime = 'Expected return time is required.'
    }
    const approvers = Array.isArray(formData.selectedApprovers) ? formData.selectedApprovers : []
    if (!approvers.length) {
        errors.selectedApprovers = 'Select at least one approver (Class Teacher is required).'
    } else if (!approvers.includes('class_teacher')) {
        errors.selectedApprovers = 'Class Teacher must be included as an approver.'
    }
    return errors
}
