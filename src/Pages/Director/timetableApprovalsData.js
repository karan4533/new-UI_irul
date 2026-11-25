/**
 * Director timetable approvals — shared SoT with Principal examination timetables.
 */
export {
    APPROVAL_STATUSES,
    SUBMITTED_BY,
    approvalStatusColor,
    getDirectorExamApprovals,
    getExamTimetableById,
    syncSharedExamsFromLiveRows,
    updateExamApprovalStatus,
    EXAM_TIMETABLE_UPDATED_EVENT,
} from '../../Common/ExaminationTimetable/examinationTimetableShared.js'

/** @deprecated Use getDirectorExamApprovals() — kept for import compatibility during migration. */
export const EXAM_TIMETABLE_APPROVALS = []

export const CLASS_TIMETABLE_APPROVALS = [
    {
        id: 'CTT001',
        classSection: 'Grade 9 - A',
        academicYear: '2025-2026',
        submittedBy: 'Principal',
        submittedDate: '15-05-2025',
        approvalStatus: 'Pending',
        rejectionReason: '',
        modalTitle: 'Grade 9 - A Timetable',
    },
    {
        id: 'CTT002',
        classSection: 'Grade 10 - B',
        academicYear: '2025-2026',
        submittedBy: 'Principal',
        submittedDate: '20-05-2025',
        approvalStatus: 'Approved',
        rejectionReason: '',
        modalTitle: 'Grade 10 - B Timetable',
    },
    {
        id: 'CTT003',
        classSection: 'Grade 8 - C',
        academicYear: '2025-2026',
        submittedBy: 'Principal',
        submittedDate: '22-05-2025',
        approvalStatus: 'Denied',
        rejectionReason: 'Period allocation exceeds the daily limit on Wednesday. Rebalance lab and theory sessions.',
        modalTitle: 'Grade 8 - C Timetable',
    },
]
