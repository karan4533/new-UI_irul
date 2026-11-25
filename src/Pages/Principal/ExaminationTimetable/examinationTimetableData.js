/**
 * Principal Examination Timetable — re-exports shared SoT used by Director approvals.
 */
export {
    APPROVAL_STATUSES,
    DAYS,
    EXAM_STATUSES,
    addExamTimetable,
    approvalStatusColor,
    buildExamGridFromTimelines,
    examStatusColor,
    formatDisplayDate,
    generateExamId,
    getClassSectionLabel,
    getExamTimetableById,
    getExamTimetables,
    saveExamTimetables,
    updateExamApprovalStatus,
} from '../../../Common/ExaminationTimetable/examinationTimetableShared.js'

export const ROUTE_BASE = '/principal/examination-timetable'
export const CREATE_ROUTE = '/principal/create-examination-timetable'

export const GRADES = ['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']
export const SECTIONS = ['A', 'B', 'C']
export const SUBJECTS = ['Tamil', 'English', 'Science', 'Social', 'EVS', 'Hindi', 'French', 'Maths', 'GK']
export const TEACHERS = ['Mr. Ravi Kumar', 'Ms. Anitha Verma', 'Dr. Suresh Menon', 'Mr. Karthik Selvan', 'Mrs. Priya Nair']

export const createTimelineRow = () => ({
    id: `TL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    day: '',
    subject: '',
    examDate: '',
    startTime: '',
    endTime: '',
})

export const defaultExamTimetableForm = () => ({
    examId: '',
    examName: '',
    className: '',
    section: '',
    teacherName: '',
    status: 'Published',
    startDate: null,
    endDate: null,
    timelines: [createTimelineRow()],
})
