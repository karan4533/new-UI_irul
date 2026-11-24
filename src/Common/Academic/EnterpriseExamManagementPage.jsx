import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
    Calendar,
    CalendarDays,
    Clock,
    FileText,
    CheckCircle2,
    AlertCircle,
    Download,
    Plus,
    Search,
    Filter,
    Award,
    BookOpen,
    Users,
    GraduationCap,
    Layers,
    ChevronRight,
    Printer,
    Sliders,
    Building2,
    ShieldAlert,
    Trash2,
    X,
    Check,
    MapPin,
    AlertTriangle,
} from 'lucide-react'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import {
    getExamHalls,
    addExamHall,
    deleteExamHall,
    getInvigilationDuties,
    scheduleInvigilationDuty,
    cancelInvigilationDuty,
    checkInvigilatorClash,
    FACULTY_INVIGILATOR_POOL,
} from './invigilationData'
import { isLiveApiEnabled } from '../../services/api/tokenStore'
import { listExams, createExam, submitExam } from '../../services/api/examsApiService'
import { IntegrationNotice } from '../ui'

/** Map FastAPI exam row (via mapExamToUi) into the existing term-card shape. */
function mapLiveExamToCard(exam = {}) {
    const approval = String(exam.approvalStatus || '').toLowerCase()
    const statusRaw = String(exam.status || '').toLowerCase()
    let status = 'Scheduled'
    if (approval === 'approved' || statusRaw === 'published') status = 'In Progress'
    else if (approval === 'denied' || approval === 'rejected') status = 'Completed'
    else if (statusRaw === 'draft' || approval === 'pending' || approval === 'draft') status = 'Scheduled'
    return {
        id: exam.id || exam.examId,
        code: exam.examType || exam.examTypeName || 'EXAM',
        title: exam.examName || exam.name || 'Untitled examination',
        term: exam.examTypeName || exam.examType || 'Assessment',
        academicYear: exam.academicYear || '—',
        applicableClasses: exam.className || exam.classSection || '—',
        startDate: exam.startDate || '—',
        endDate: exam.endDate || '—',
        marksEntryDeadline: '—',
        resultDate: '—',
        status,
        totalPapers: 0,
        marksEnteredPapers: 0,
        source: 'backend',
        approvalStatus: exam.approvalStatus,
    }
}

const EMPTY_CREATE_FORM = {
    name: '',
    examType: 'MIDTERM',
    className: 'Class 10',
    academicYear: '2025-2026',
    startDate: '',
    endDate: '',
}

// Master Examination Terms & Schedules
export const EXAMINATION_TERMS = [
    {
        id: 'EXAM-2026-T1-MID',
        code: 'T1-MID',
        title: 'Term 1 Mid-Term Examination',
        term: 'Term 1',
        academicYear: '2025-2026',
        applicableClasses: 'Grade 6 to 12',
        startDate: '12-09-2025',
        endDate: '24-09-2025',
        marksEntryDeadline: '05-10-2025',
        resultDate: '10-10-2025',
        status: 'Results Published',
        totalPapers: 36,
        marksEnteredPapers: 36,
    },
    {
        id: 'EXAM-2026-T1-FINAL',
        code: 'T1-HY',
        title: 'Half-Yearly Examination (Term 1 Summative)',
        term: 'Term 1',
        academicYear: '2025-2026',
        applicableClasses: 'Grade 1 to 12',
        startDate: '15-11-2025',
        endDate: '30-11-2025',
        marksEntryDeadline: '10-12-2025',
        resultDate: '18-12-2025',
        status: 'Results Published',
        totalPapers: 48,
        marksEnteredPapers: 48,
    },
    {
        id: 'EXAM-2026-PA2',
        code: 'PA-02',
        title: 'Periodic Assessment 2 (Unit Test)',
        term: 'Term 2',
        academicYear: '2025-2026',
        applicableClasses: 'Grade 6 to 11',
        startDate: '18-01-2026',
        endDate: '25-01-2026',
        marksEntryDeadline: '02-02-2026',
        resultDate: '08-02-2026',
        status: 'Completed',
        totalPapers: 30,
        marksEnteredPapers: 30,
    },
    {
        id: 'EXAM-2026-PREBOARD',
        code: 'PRE-BD',
        title: 'Pre-Board Mock Examination (Class 10 & 12)',
        term: 'Term 2',
        academicYear: '2025-2026',
        applicableClasses: 'Grade 10 & 12',
        startDate: '05-02-2026',
        endDate: '20-02-2026',
        marksEntryDeadline: '28-02-2026',
        resultDate: '05-03-2026',
        status: 'Evaluation Ongoing',
        totalPapers: 14,
        marksEnteredPapers: 11,
    },
    {
        id: 'EXAM-2026-ANNUAL',
        code: 'ANN-2026',
        title: 'Annual Final Examination 2026',
        term: 'Term 2',
        academicYear: '2025-2026',
        applicableClasses: 'Grade 1 to 9 & 11',
        startDate: '10-03-2026',
        endDate: '28-03-2026',
        marksEntryDeadline: '05-04-2026',
        resultDate: '15-04-2026',
        status: 'Scheduled',
        totalPapers: 52,
        marksEnteredPapers: 0,
    },
    {
        id: 'EXAM-2026-BOARD',
        code: 'CBSE-BD',
        title: 'All India Secondary School Examination (AISSE)',
        term: 'National Board',
        academicYear: '2025-2026',
        applicableClasses: 'Grade 10 & 12',
        startDate: '15-02-2026',
        endDate: '02-04-2026',
        marksEntryDeadline: 'N/A (External)',
        resultDate: '15-05-2026',
        status: 'In Progress',
        totalPapers: 12,
        marksEnteredPapers: 0,
    },
]

// Subject Weightage & Blueprint Scheme
export const SUBJECT_BLUEPRINTS = [
    { subject: 'Mathematics', theory: 80, internal: 20, practical: 0, total: 100, passMarks: 33, duration: '3 Hours', format: 'Subjective + Objective MCQ' },
    { subject: 'Science & Technology', theory: 70, internal: 10, practical: 20, total: 100, passMarks: 33, duration: '3 Hours', format: 'Theory (70) + Practical Lab (20) + Portfolio (10)' },
    { subject: 'English Language & Literature', theory: 80, internal: 20, practical: 0, total: 100, passMarks: 33, duration: '3 Hours', format: 'Reading (20) + Writing/Grammar (20) + Literature (40)' },
    { subject: 'Social Science', theory: 80, internal: 20, practical: 0, total: 100, passMarks: 33, duration: '3 Hours', format: 'History (20) + Geography (20) + Civics (20) + Economics (20)' },
    { subject: 'Computer Applications & AI', theory: 50, internal: 0, practical: 50, total: 100, passMarks: 33, duration: '2 Hours', format: 'Theory Exam (50) + Hands-on Lab Project (50)' },
    { subject: 'Regional Language (Tamil/Hindi)', theory: 80, internal: 20, practical: 0, total: 100, passMarks: 33, duration: '3 Hours', format: 'Prose, Poetry & Grammar' },
]

// Official Grading Scale
export const GRADING_SCALE = [
    { grade: 'A1', range: '91% – 100%', gradePoint: '10.0', remark: 'Outstanding Academic Performance', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { grade: 'A2', range: '81% – 90%', gradePoint: '9.0', remark: 'Excellent Mastery of Competencies', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
    { grade: 'B1', range: '71% – 80%', gradePoint: '8.0', remark: 'Very Good Conceptual Understanding', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { grade: 'B2', range: '61% – 70%', gradePoint: '7.0', remark: 'Good Academic Progress', badge: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    { grade: 'C1', range: '51% – 60%', gradePoint: '6.0', remark: 'Fair & Satisfactory Achievement', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
    { grade: 'C2', range: '41% – 50%', gradePoint: '5.0', remark: 'Average Attainment Standard', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
    { grade: 'D', range: '33% – 40%', gradePoint: '4.0', remark: 'Marginal Pass Threshold', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
    { grade: 'E', range: 'Below 33%', gradePoint: '0.0', remark: 'Remedial / Essential Repeat Required', badge: 'bg-red-100 text-red-800 border-red-200' },
]

// Invigilation & Seating Allocations
export const INVIGILATION_DUTIES = [
    { room: 'Examination Hall 1 (East Wing)', capacity: 60, invigilator: 'Dr. Subramanian (Physics Lead)', backup: 'Priya Menon', classes: 'Grade 10-A, 10-B' },
    { room: 'Examination Hall 2 (West Wing)', capacity: 60, invigilator: 'S. Ramanathan (Math Dept)', backup: 'K. Meenakshi', classes: 'Grade 12-A, 12-B' },
    { room: 'Hall 301 (Senior Block)', capacity: 40, invigilator: 'Ananya Sharma (Chemistry)', backup: 'R. Venkatesh', classes: 'Grade 9-A' },
    { room: 'Hall 302 (Senior Block)', capacity: 40, invigilator: 'M. Harikrishnan (English)', backup: 'S. Divya', classes: 'Grade 9-B' },
]

const EnterpriseExamManagementPage = ({ roleOverride }) => {
    const { role: authRole } = useAuth() || {}
    const activeRole = String(roleOverride || authRole || 'teacher').toLowerCase().replace(/[-_\s]/g, '')
    const live = isLiveApiEnabled()
    const isTeacher = activeRole === 'teacher'
    // Matches FastAPI exams.write holders used in this product surface (teacher has read only).
    const canCreateExam = ['coordinator', 'principal', 'director', 'admin', 'superadmin'].includes(activeRole)

    const canManageDuties = ['coordinator', 'principal', 'director', 'admin', 'superadmin'].includes(activeRole)

    const [activeTab, setActiveTab] = useState('schedules') // 'schedules' | 'blueprints' | 'grading' | 'duties'
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [classFilter, setClassFilter] = useState('ALL')
    const [actionNotice, setActionNotice] = useState('')
    const [liveExams, setLiveExams] = useState([])
    const [liveLoading, setLiveLoading] = useState(Boolean(live))
    const [liveError, setLiveError] = useState('')
    const [showCreateExamModal, setShowCreateExamModal] = useState(false)
    const [createForm, setCreateForm] = useState(() => ({ ...EMPTY_CREATE_FORM }))
    const [createSaving, setCreateSaving] = useState(false)
    const [createError, setCreateError] = useState('')

    const loadLiveExams = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setLiveLoading(false)
            return
        }
        setLiveLoading(true)
        setLiveError('')
        const res = await listExams()
        if (!res.success) {
            setLiveExams([])
            setLiveError(typeof res.error === 'string' ? res.error : 'Could not load /api/v1/exams.')
            setLiveLoading(false)
            return
        }
        setLiveExams((res.data || []).map(mapLiveExamToCard))
        setLiveLoading(false)
    }, [])

    useEffect(() => {
        loadLiveExams()
    }, [loadLiveExams])

    // Invigilation & Halls State
    const [halls, setHalls] = useState(() => getExamHalls())
    const [duties, setDuties] = useState(() => getInvigilationDuties())
    const [dutySubTab, setDutySubTab] = useState('duties') // 'duties' | 'halls'
    const [dutySearch, setDutySearch] = useState('')
    const [dutyStatusFilter, setDutyStatusFilter] = useState('ALL')
    const [showScheduleDutyModal, setShowScheduleDutyModal] = useState(false)
    const [showAddHallModal, setShowAddHallModal] = useState(false)

    // Form states
    const [newDutyForm, setNewDutyForm] = useState({
        hallId: '',
        examName: 'Mid-Term Board Examination 2025',
        subject: 'Mathematics',
        sessionDate: '2026-03-27',
        startTime: '09:00 AM',
        endTime: '12:00 PM',
        primaryInvigilator: FACULTY_INVIGILATOR_POOL[0]?.name || '',
        reserveInvigilator: FACULTY_INVIGILATOR_POOL[1]?.name || '',
        candidateClasses: 'Grade 10-A, 10-B',
    })
    const [dutyConflictError, setDutyConflictError] = useState('')

    const [newHallForm, setNewHallForm] = useState({
        hallName: '',
        wingBlock: 'Academic Wing (Level 2)',
        rows: 6,
        columns: 10,
        capacity: 60,
        facilities: ['CCTV Surveillance', 'Central Air Conditioning'],
    })

    const refreshDutiesAndHalls = () => {
        setHalls(getExamHalls())
        setDuties(getInvigilationDuties())
    }

    const checkCurrentFormConflict = (formState) => {
        const clash = checkInvigilatorClash({
            invigilatorName: formState.primaryInvigilator,
            sessionDate: formState.sessionDate,
            startTime: formState.startTime,
            endTime: formState.endTime,
        })
        if (clash?.hasClash) {
            setDutyConflictError(clash.message)
            return clash
        }
        if (formState.reserveInvigilator) {
            const resClash = checkInvigilatorClash({
                invigilatorName: formState.reserveInvigilator,
                sessionDate: formState.sessionDate,
                startTime: formState.startTime,
                endTime: formState.endTime,
            })
            if (resClash?.hasClash) {
                setDutyConflictError(resClash.message)
                return resClash
            }
        }
        setDutyConflictError('')
        return { hasClash: false }
    }

    const handleOpenScheduleModal = () => {
        const defaultHall = halls[0] || {}
        const initialForm = {
            hallId: defaultHall.id || 'HALL-001',
            hallName: defaultHall.hallName || 'Examination Hall 1',
            capacity: defaultHall.capacity || 60,
            examName: 'Mid-Term Board Examination 2025',
            subject: 'Mathematics',
            sessionDate: '2026-03-27',
            startTime: '09:00 AM',
            endTime: '12:00 PM',
            primaryInvigilator: FACULTY_INVIGILATOR_POOL[0]?.name || '',
            reserveInvigilator: FACULTY_INVIGILATOR_POOL[1]?.name || '',
            candidateClasses: 'Grade 10-A, 10-B',
        }
        setNewDutyForm(initialForm)
        checkCurrentFormConflict(initialForm)
        setShowScheduleDutyModal(true)
    }

    const handleDutyFormChange = (patch) => {
        const updated = { ...newDutyForm, ...patch }
        if (patch.hallId) {
            const selectedHall = halls.find((h) => h.id === patch.hallId)
            if (selectedHall) {
                updated.hallName = selectedHall.hallName
                updated.capacity = selectedHall.capacity
            }
        }
        setNewDutyForm(updated)
        checkCurrentFormConflict(updated)
    }

    const handleScheduleDutySubmit = (e) => {
        e.preventDefault()
        const conflict = checkCurrentFormConflict(newDutyForm)
        if (conflict?.hasClash) {
            return
        }

        try {
            scheduleInvigilationDuty(newDutyForm)
            refreshDutiesAndHalls()
            setShowScheduleDutyModal(false)
            setActionNotice(`Invigilation duty allocated for ${newDutyForm.primaryInvigilator} in ${newDutyForm.hallName}.`)
            setTimeout(() => setActionNotice(''), 4500)
        } catch (err) {
            setDutyConflictError(err.message)
        }
    }

    const handleCancelDuty = (dutyId, roomName) => {
        cancelInvigilationDuty(dutyId, 'Cancelled by Academic Coordinator')
        refreshDutiesAndHalls()
        setActionNotice(`Invigilation duty for ${roomName} has been cancelled.`)
        setTimeout(() => setActionNotice(''), 4000)
    }

    const handleAddHallSubmit = (e) => {
        e.preventDefault()
        if (!newHallForm.hallName.trim()) return
        addExamHall(newHallForm)
        refreshDutiesAndHalls()
        setShowAddHallModal(false)
        setNewHallForm({
            hallName: '',
            wingBlock: 'Academic Wing (Level 2)',
            rows: 6,
            columns: 10,
            capacity: 60,
            facilities: ['CCTV Surveillance'],
        })
        setActionNotice(`New examination hall "${newHallForm.hallName}" registered successfully.`)
        setTimeout(() => setActionNotice(''), 4500)
    }

    const handleDeleteHall = (hallId, hallName) => {
        deleteExamHall(hallId)
        refreshDutiesAndHalls()
        setActionNotice(`Examination hall "${hallName}" deleted.`)
        setTimeout(() => setActionNotice(''), 4000)
    }

    const scheduleSource = live ? liveExams : EXAMINATION_TERMS

    const filteredExams = useMemo(() => {
        return scheduleSource.filter((e) => {
            if (statusFilter !== 'ALL' && e.status !== statusFilter) return false
            if (classFilter !== 'ALL' && !String(e.applicableClasses || '').includes(classFilter)) return false
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase()
                return (
                    String(e.title || '').toLowerCase().includes(q) ||
                    String(e.code || '').toLowerCase().includes(q) ||
                    String(e.term || '').toLowerCase().includes(q)
                )
            }
            return true
        })
    }, [scheduleSource, statusFilter, classFilter, searchTerm])

    const handleDownloadSchedule = () => {
        if (live) {
            setActionNotice('PDF export is not wired to a backend endpoint — download remains local/demo only.')
        } else {
            setActionNotice('Official examination schedule and student hall ticket roster exported successfully.')
        }
        setTimeout(() => setActionNotice(''), 4000)
    }

    const handleOpenCreateExam = () => {
        if (!canCreateExam) return
        if (live) {
            setCreateForm({ ...EMPTY_CREATE_FORM, startDate: '2026-12-01', endDate: '2026-12-05' })
            setCreateError('')
            setShowCreateExamModal(true)
            return
        }
        setActionNotice('New examination term creator opened. Institutional parameters applied.')
        setTimeout(() => setActionNotice(''), 4000)
    }

    const handleCreateExamSubmit = async (e) => {
        e.preventDefault()
        if (!canCreateExam || !live) return
        if (!createForm.name.trim() || !createForm.className.trim() || !createForm.startDate || !createForm.endDate) {
            setCreateError('Name, class, start date, and end date are required.')
            return
        }
        setCreateSaving(true)
        setCreateError('')
        const created = await createExam({
            name: createForm.name.trim(),
            examType: createForm.examType || 'MIDTERM',
            className: createForm.className.trim(),
            academicYear: createForm.academicYear || null,
            startDateIso: createForm.startDate,
            endDateIso: createForm.endDate,
        })
        if (!created.success) {
            setCreateSaving(false)
            setCreateError(created.error || 'Exam create failed.')
            toast.error(created.error || 'Exam create failed.')
            return
        }
        const examId = created.data?.id || created.data?.examId
        if (examId) {
            const submitted = await submitExam(examId)
            if (!submitted.success) {
                setCreateSaving(false)
                setCreateError(submitted.error || 'Exam created but submit for approval failed.')
                toast.error(submitted.error || 'Exam created but submit failed.')
                await loadLiveExams()
                return
            }
        }
        setCreateSaving(false)
        setShowCreateExamModal(false)
        await loadLiveExams()
        setActionNotice(`Examination "${createForm.name.trim()}" saved on the server (GET /api/v1/exams).`)
        toast.success('Examination persisted on the server.')
        setTimeout(() => setActionNotice(''), 4500)
    }

    return (
        <section className='space-y-6 pb-10 font-sans'>
            {/* Top Workspace Header */}
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                <div>
                    <div className='flex items-center gap-2.5'>
                        <h1 className='text-2xl font-bold tracking-tight text-slate-900'>
                            Examinations & Academic Assessment
                        </h1>
                        <span className='px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold'>
                            Academic Year 2025–2026
                        </span>
                        {isTeacher && (
                            <span className='px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold'>
                                Teacher View
                            </span>
                        )}
                    </div>
                    <p className='mt-1 text-xs text-slate-500'>
                        {isTeacher
                            ? 'Official institutional examination schedules, subject blueprints, grading standards, and duty rosters (Scheduled by Examination Cell).'
                            : 'Centralized institutional examination scheduling, subject blueprints, grading standards, and hall duty invigilation.'}
                    </p>
                </div>

                <div className='flex items-center gap-2.5 flex-wrap'>
                    <button
                        type='button'
                        onClick={handleDownloadSchedule}
                        className='inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer'
                    >
                        <Download size={14} /> Download Schedule (PDF)
                    </button>
                    {canCreateExam ? (
                        <button
                            type='button'
                            onClick={handleOpenCreateExam}
                            className='inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer'
                        >
                            <Plus size={14} /> Schedule Examination
                        </button>
                    ) : (
                        <span className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold'>
                            <ShieldAlert size={13} className='text-slate-400' />
                            View Only
                        </span>
                    )}
                </div>
            </div>

            {live && !liveError ? (
                <IntegrationNotice
                    state='connected'
                    title='Live examination schedules'
                    description='Schedules tab hydrates from GET /api/v1/exams. Create uses POST /api/v1/exams + submit (exams.write). Blueprints, grading bands, and invigilation halls remain LOCAL ONLY / MOCK — no hall/duty API.'
                />
            ) : null}
            {live && liveError ? (
                <IntegrationNotice
                    state='failed'
                    title='Exam list unavailable'
                    description={liveError}
                />
            ) : null}

            {/* Action Notice */}
            {actionNotice && (
                <div className='p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in'>
                    <CheckCircle2 size={16} className='text-emerald-600 shrink-0' />
                    <span>{actionNotice}</span>
                </div>
            )}

            {/* KPI Summary Cards */}
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
                <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-1.5'>
                    <div className='flex items-center justify-between text-slate-500'>
                        <span className='text-xs font-semibold'>Scheduled Terms</span>
                        <CalendarDays size={18} className='text-blue-600' />
                    </div>
                    <p className='text-2xl font-bold tracking-tight text-slate-900'>
                        {live ? `${liveExams.length} Live Exam${liveExams.length === 1 ? '' : 's'}` : '6 Active Cycles'}
                    </p>
                    <p className='text-[11px] text-slate-500'>
                        {live ? 'From GET /api/v1/exams' : 'Pre-Board & Annual active'}
                    </p>
                </div>

                <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-1.5'>
                    <div className='flex items-center justify-between text-slate-500'>
                        <span className='text-xs font-semibold'>Total Assessment Papers</span>
                        <BookOpen size={18} className='text-indigo-600' />
                    </div>
                    <p className='text-2xl font-bold tracking-tight text-slate-900'>
                        {live ? '—' : '192 Subject Papers'}
                    </p>
                    <p className='text-[11px] text-slate-500'>
                        {live ? 'Paper counts not on exams API' : '82% evaluations finalized'}
                    </p>
                </div>

                <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-1.5'>
                    <div className='flex items-center justify-between text-slate-500'>
                        <span className='text-xs font-semibold'>Enrolled Candidates</span>
                        <Users size={18} className='text-purple-600' />
                    </div>
                    <p className='text-2xl font-bold tracking-tight text-slate-900'>
                        {live ? '—' : '1,240 Students'}
                    </p>
                    <p className='text-[11px] text-slate-500'>
                        {live ? 'Candidate roster not on exams API' : 'Classes 1 through 12'}
                    </p>
                </div>

                <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-1.5'>
                    <div className='flex items-center justify-between text-slate-500'>
                        <span className='text-xs font-semibold'>Passing Threshold</span>
                        <Award size={18} className='text-amber-600' />
                    </div>
                    <p className='text-2xl font-bold tracking-tight text-slate-900'>33.0% Minimum</p>
                    <p className='text-[11px] text-slate-500'>Theory + Internal composite</p>
                </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className='border-b border-slate-200 flex items-center space-x-2 sm:space-x-4 overflow-x-auto text-xs font-semibold'>
                <button
                    type='button'
                    onClick={() => setActiveTab('schedules')}
                    className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                        activeTab === 'schedules'
                            ? 'border-blue-600 text-blue-700 font-bold bg-blue-50/30'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Calendar size={15} /> Examination Schedules & Terms
                </button>
                <button
                    type='button'
                    onClick={() => setActiveTab('blueprints')}
                    className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                        activeTab === 'blueprints'
                            ? 'border-blue-600 text-blue-700 font-bold bg-blue-50/30'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <FileText size={15} /> Subject Blueprints & Weightage
                </button>
                <button
                    type='button'
                    onClick={() => setActiveTab('grading')}
                    className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                        activeTab === 'grading'
                            ? 'border-blue-600 text-blue-700 font-bold bg-blue-50/30'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Award size={15} /> Grading Scale & Performance Bands
                </button>
                <button
                    type='button'
                    onClick={() => setActiveTab('duties')}
                    className={`py-3 px-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                        activeTab === 'duties'
                            ? 'border-blue-600 text-blue-700 font-bold bg-blue-50/30'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Building2 size={15} /> Invigilation Duties & Halls
                </button>
            </div>

            {/* TAB 1: Examination Schedules */}
            {activeTab === 'schedules' && (
                <div className='space-y-4'>
                    {liveLoading ? (
                        <div className='rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600'>
                            Loading examinations from the server…
                        </div>
                    ) : null}
                    {/* Filters Bar */}
                    <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3'>
                        <div className='relative flex-1 max-w-sm'>
                            <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' />
                            <input
                                type='text'
                                placeholder='Search examination term, code...'
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className='w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500'
                            />
                        </div>

                        <div className='flex items-center gap-2.5 flex-wrap'>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className='px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none'
                            >
                                <option value='ALL'>All Statuses</option>
                                <option value='Scheduled'>Scheduled</option>
                                <option value='In Progress'>In Progress</option>
                                <option value='Evaluation Ongoing'>Evaluation Ongoing</option>
                                <option value='Completed'>Completed</option>
                                <option value='Results Published'>Results Published</option>
                            </select>

                            <select
                                value={classFilter}
                                onChange={(e) => setClassFilter(e.target.value)}
                                className='px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none'
                            >
                                <option value='ALL'>All Classes</option>
                                <option value='10'>Class 10</option>
                                <option value='12'>Class 12</option>
                                <option value='6 to 12'>Secondary (6-12)</option>
                                <option value='1 to 12'>Whole School (1-12)</option>
                            </select>
                        </div>
                    </div>

                    {/* Examination Cards Grid */}
                    {!liveLoading && filteredExams.length === 0 ? (
                        <div className='rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-600'>
                            {live ? 'No examinations returned from GET /api/v1/exams for the current filters.' : 'No examination terms match the current filters.'}
                        </div>
                    ) : null}
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                        {filteredExams.map((exam) => {
                            const isPublished = exam.status === 'Results Published'
                            const isInProgress = exam.status === 'In Progress'
                            const isScheduled = exam.status === 'Scheduled'
                            const isEvaluating = exam.status === 'Evaluation Ongoing'

                            const badgeStyle = isPublished
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isInProgress
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : isEvaluating
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'

                            return (
                                <div
                                    key={exam.id}
                                    className='rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-all space-y-4'
                                >
                                    <div className='space-y-2.5'>
                                        <div className='flex items-center justify-between gap-2'>
                                            <span className='font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md'>
                                                {exam.code}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyle}`}>
                                                {exam.status}
                                            </span>
                                        </div>

                                        <h3 className='font-bold text-slate-900 text-sm leading-snug'>
                                            {exam.title}
                                        </h3>
                                        <p className='text-xs text-slate-500'>
                                            Scope: <span className='font-semibold text-slate-700'>{exam.applicableClasses}</span>
                                        </p>

                                        <div className='space-y-1.5 pt-2 text-xs border-t border-slate-100'>
                                            <div className='flex items-center justify-between text-slate-600'>
                                                <span>Exam Window:</span>
                                                <span className='font-semibold text-slate-800'>{exam.startDate} to {exam.endDate}</span>
                                            </div>
                                            <div className='flex items-center justify-between text-slate-600'>
                                                <span>Marks Deadline:</span>
                                                <span className='font-semibold text-slate-800'>{exam.marksEntryDeadline}</span>
                                            </div>
                                            <div className='flex items-center justify-between text-slate-600'>
                                                <span>Result Date:</span>
                                                <span className='font-semibold text-slate-800'>{exam.resultDate}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className='pt-3 border-t border-slate-100 flex items-center justify-between'>
                                        <div className='text-[11px] text-slate-500'>
                                            Evaluated: <span className='font-bold text-slate-800'>{exam.marksEnteredPapers}/{exam.totalPapers}</span> papers
                                        </div>
                                        <button
                                            type='button'
                                            onClick={() => {
                                                setActionNotice(`Navigated to marks entry & assessment roster for ${exam.title}.`)
                                                setTimeout(() => setActionNotice(''), 4000)
                                            }}
                                            className='text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer'
                                        >
                                            View Schedule <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* TAB 2: Subject Blueprints & Weightage */}
            {activeTab === 'blueprints' && (
                <div className='rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4'>
                    {live ? (
                        <IntegrationNotice
                            state='mock'
                            title='Blueprints — LOCAL ONLY / MOCK'
                            description='GET/PUT /api/v1/exam-weightage exists for class weightage but this matrix UI is still static. Weightage write also needs exams.configure (Coordinator does not have it).'
                        />
                    ) : null}
                    <div>
                        <h3 className='text-sm font-bold text-slate-900'>Subject Assessment Blueprints & Weightage Matrix</h3>
                        <p className='text-xs text-slate-500 mt-0.5'>
                            Governed allocation between theory examinations, practical laboratories, and internal continuous assessments.
                        </p>
                    </div>

                    <div className='overflow-x-auto'>
                        <table className='w-full text-left text-xs'>
                            <thead>
                                <tr className='border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase'>
                                    <th className='py-3 px-4'>Subject</th>
                                    <th className='py-3 px-4 text-center'>Theory Marks</th>
                                    <th className='py-3 px-4 text-center'>Internal Assessment</th>
                                    <th className='py-3 px-4 text-center'>Practical Lab</th>
                                    <th className='py-3 px-4 text-center'>Maximum Total</th>
                                    <th className='py-3 px-4 text-center'>Passing Benchmark</th>
                                    <th className='py-3 px-4'>Duration & Format</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-slate-100 text-slate-700'>
                                {SUBJECT_BLUEPRINTS.map((bp) => (
                                    <tr key={bp.subject} className='hover:bg-slate-50/60 transition-colors'>
                                        <td className='py-3 px-4 font-bold text-slate-900'>{bp.subject}</td>
                                        <td className='py-3 px-4 text-center font-semibold text-slate-800'>{bp.theory}</td>
                                        <td className='py-3 px-4 text-center font-semibold text-slate-800'>{bp.internal}</td>
                                        <td className='py-3 px-4 text-center font-semibold text-slate-800'>{bp.practical || '—'}</td>
                                        <td className='py-3 px-4 text-center font-bold text-blue-700'>{bp.total}</td>
                                        <td className='py-3 px-4 text-center'>
                                            <span className='px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100'>
                                                {bp.passMarks}% ({Math.ceil(bp.total * (bp.passMarks / 100))})
                                            </span>
                                        </td>
                                        <td className='py-3 px-4'>
                                            <span className='font-semibold text-slate-800'>{bp.duration}</span>
                                            <p className='text-[11px] text-slate-500'>{bp.format}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: Grading Scale & Performance Bands */}
            {activeTab === 'grading' && (
                <div className='rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4'>
                    {live ? (
                        <IntegrationNotice
                            state='mock'
                            title='Grading scale — LOCAL ONLY'
                            description='No FastAPI grading-band endpoint is mounted. Display standards only.'
                        />
                    ) : null}
                    <div>
                        <h3 className='text-sm font-bold text-slate-900'>Institutional Grading Standards & Performance Descriptors</h3>
                        <p className='text-xs text-slate-500 mt-0.5'>
                            Standardized academic classification benchmarks mapped directly to grade points and transcript notations.
                        </p>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2'>
                        {GRADING_SCALE.map((item) => (
                            <div
                                key={item.grade}
                                className='rounded-xl border border-slate-200/80 bg-white p-4 space-y-2 shadow-2xs hover:shadow-xs transition-shadow'
                            >
                                <div className='flex items-center justify-between'>
                                    <span className={`px-2.5 py-1 rounded-lg text-sm font-black border ${item.badge}`}>
                                        Grade {item.grade}
                                    </span>
                                    <span className='font-mono text-xs font-bold text-slate-700'>
                                        GP: {item.gradePoint}
                                    </span>
                                </div>
                                <div className='text-xs font-bold text-slate-900'>{item.range}</div>
                                <p className='text-[11px] text-slate-500 leading-snug'>{item.remark}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 4: Invigilation Duties & Halls */}
            {activeTab === 'duties' && (
                <div className='space-y-4'>
                    {live ? (
                        <IntegrationNotice
                            state='mock'
                            title='Invigilation & halls — LOCAL ONLY'
                            description='Hall and duty roster changes stay in this browser. There is no FastAPI invigilation/halls collection.'
                        />
                    ) : null}
                    {/* Invigilation Metrics Overview */}
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                        <div className='p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs'>
                            <span className='text-[10px] uppercase font-bold text-slate-500 tracking-wider block'>Examination Halls</span>
                            <div className='flex items-baseline justify-between mt-1'>
                                <span className='text-2xl font-black text-slate-900'>{halls.length}</span>
                                <span className='text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md'>Active</span>
                            </div>
                        </div>
                        <div className='p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs'>
                            <span className='text-[10px] uppercase font-bold text-slate-500 tracking-wider block'>Total Desk Capacity</span>
                            <div className='flex items-baseline justify-between mt-1'>
                                <span className='text-2xl font-black text-slate-900'>
                                    {halls.reduce((sum, h) => sum + (Number(h.capacity) || 0), 0)}
                                </span>
                                <span className='text-xs font-semibold text-slate-500'>Desks</span>
                            </div>
                        </div>
                        <div className='p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs'>
                            <span className='text-[10px] uppercase font-bold text-slate-500 tracking-wider block'>Scheduled Duties</span>
                            <div className='flex items-baseline justify-between mt-1'>
                                <span className='text-2xl font-black text-slate-900'>
                                    {duties.filter((d) => d.status !== 'Cancelled').length}
                                </span>
                                <span className='text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md'>Allocated</span>
                            </div>
                        </div>
                        <div className='p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs'>
                            <span className='text-[10px] uppercase font-bold text-slate-500 tracking-wider block'>Faculty Pool</span>
                            <div className='flex items-baseline justify-between mt-1'>
                                <span className='text-2xl font-black text-slate-900'>{FACULTY_INVIGILATOR_POOL.length}</span>
                                <span className='text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md'>Teachers</span>
                            </div>
                        </div>
                    </div>

                    {/* Sub Navigation & Actions Bar */}
                    <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3'>
                        <div className='flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit'>
                            <button
                                type='button'
                                onClick={() => setDutySubTab('duties')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    dutySubTab === 'duties' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Duty Roster Allocation ({duties.length})
                            </button>
                            <button
                                type='button'
                                onClick={() => setDutySubTab('halls')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    dutySubTab === 'halls' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Examination Halls &amp; Layouts ({halls.length})
                            </button>
                        </div>

                        <div className='flex items-center gap-2 flex-wrap'>
                            {dutySubTab === 'duties' && (
                                <>
                                    <div className='relative'>
                                        <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' />
                                        <input
                                            type='text'
                                            placeholder='Search teacher or room...'
                                            value={dutySearch}
                                            onChange={(e) => setDutySearch(e.target.value)}
                                            className='pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500'
                                        />
                                    </div>
                                    <select
                                        value={dutyStatusFilter}
                                        onChange={(e) => setDutyStatusFilter(e.target.value)}
                                        className='px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none'
                                    >
                                        <option value='ALL'>All Statuses</option>
                                        <option value='Scheduled'>Scheduled</option>
                                        <option value='Cancelled'>Cancelled</option>
                                    </select>
                                    {canManageDuties && (
                                        <button
                                            type='button'
                                            onClick={handleOpenScheduleModal}
                                            className='inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer'
                                        >
                                            <Plus size={14} /> Schedule Invigilation
                                        </button>
                                    )}
                                    <button
                                        type='button'
                                        onClick={() => {
                                            setActionNotice('Invigilation duty roster PDF generated with room floor plans.')
                                            setTimeout(() => setActionNotice(''), 4000)
                                        }}
                                        className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer'
                                    >
                                        <Printer size={14} /> Print Roster
                                    </button>
                                </>
                            )}

                            {dutySubTab === 'halls' && canManageDuties && (
                                <button
                                    type='button'
                                    onClick={() => setShowAddHallModal(true)}
                                    className='inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer'
                                >
                                    <Plus size={14} /> Add Examination Hall
                                </button>
                            )}
                        </div>
                    </div>

                    {/* SUBTAB 1: Invigilation Duties List */}
                    {dutySubTab === 'duties' && (
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            {duties
                                .filter((d) => {
                                    if (dutyStatusFilter !== 'ALL' && d.status !== dutyStatusFilter) return false
                                    if (dutySearch.trim()) {
                                        const q = dutySearch.toLowerCase()
                                        return (
                                            (d.hallName || '').toLowerCase().includes(q) ||
                                            (d.primaryInvigilator || '').toLowerCase().includes(q) ||
                                            (d.reserveInvigilator || '').toLowerCase().includes(q) ||
                                            (d.subject || '').toLowerCase().includes(q)
                                        )
                                    }
                                    return true
                                })
                                .map((duty) => {
                                    const isCancelled = duty.status === 'Cancelled'
                                    return (
                                        <div
                                            key={duty.id}
                                            className={`p-4 rounded-xl border bg-white space-y-3 transition-shadow ${
                                                isCancelled ? 'border-red-200/80 bg-red-50/20 opacity-80' : 'border-slate-200/80 shadow-2xs hover:shadow-xs'
                                            }`}
                                        >
                                            <div className='flex items-start justify-between gap-2'>
                                                <div>
                                                    <div className='flex items-center gap-2'>
                                                        <h4 className='font-bold text-slate-900 text-sm'>{duty.hallName}</h4>
                                                        <span
                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                                isCancelled
                                                                    ? 'bg-red-50 text-red-700 border-red-200'
                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            }`}
                                                        >
                                                            {duty.status}
                                                        </span>
                                                    </div>
                                                    <p className='text-xs text-slate-500 mt-0.5'>
                                                        {duty.examName} • <span className='font-semibold text-slate-700'>{duty.subject}</span>
                                                    </p>
                                                </div>
                                                <span className='text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg shrink-0'>
                                                    {duty.capacity} Desks
                                                </span>
                                            </div>

                                            <div className='grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100'>
                                                <div>
                                                    <span className='block text-[10px] uppercase font-bold text-slate-400'>Session Date &amp; Time</span>
                                                    <span className='font-semibold text-slate-800'>{duty.sessionDate}</span>
                                                    <span className='block text-slate-500 text-[11px]'>{duty.startTime} – {duty.endTime}</span>
                                                </div>
                                                <div>
                                                    <span className='block text-[10px] uppercase font-bold text-slate-400'>Candidate Cohort</span>
                                                    <span className='font-semibold text-slate-800'>{duty.candidateClasses}</span>
                                                </div>
                                            </div>

                                            <div className='text-xs space-y-1.5 text-slate-600 pt-1'>
                                                <div className='flex items-center justify-between'>
                                                    <span className='text-slate-500'>Primary Invigilator:</span>
                                                    <span className='font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded'>
                                                        {duty.primaryInvigilator}
                                                    </span>
                                                </div>
                                                <div className='flex items-center justify-between'>
                                                    <span className='text-slate-500'>Reserve Invigilator:</span>
                                                    <span className='font-medium text-slate-700'>{duty.reserveInvigilator}</span>
                                                </div>
                                            </div>

                                            {isCancelled && duty.cancellationReason && (
                                                <div className='text-[11px] text-red-700 bg-red-50 p-2 rounded-lg border border-red-100'>
                                                    Cancellation Note: {duty.cancellationReason}
                                                </div>
                                            )}

                                            {!isCancelled && canManageDuties && (
                                                <div className='pt-2 border-t border-slate-100 flex items-center justify-end gap-2'>
                                                    <button
                                                        type='button'
                                                        onClick={() => handleCancelDuty(duty.id, duty.hallName)}
                                                        className='text-[11px] font-semibold text-red-600 hover:text-red-800 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer'
                                                    >
                                                        Cancel Duty
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                        </div>
                    )}

                    {/* SUBTAB 2: Examination Halls List */}
                    {dutySubTab === 'halls' && (
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                            {halls.map((hall) => (
                                <div key={hall.id} className='rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3'>
                                    <div className='flex items-start justify-between gap-2'>
                                        <div>
                                            <div className='flex items-center gap-1.5'>
                                                <span className='font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded'>
                                                    {hall.id}
                                                </span>
                                                <h4 className='font-bold text-slate-900 text-sm'>{hall.hallName}</h4>
                                            </div>
                                            <p className='text-xs text-slate-500 mt-0.5 flex items-center gap-1'>
                                                <MapPin size={12} className='text-slate-400' /> {hall.wingBlock}
                                            </p>
                                        </div>
                                        {canManageDuties && halls.length > 1 && (
                                            <button
                                                type='button'
                                                onClick={() => handleDeleteHall(hall.id, hall.hallName)}
                                                className='text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer'
                                                title='Delete Hall'
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <div className='grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100'>
                                        <div>
                                            <span className='block text-[10px] uppercase font-bold text-slate-400'>Total Capacity</span>
                                            <span className='text-base font-black text-blue-700'>{hall.capacity} Desks</span>
                                        </div>
                                        <div>
                                            <span className='block text-[10px] uppercase font-bold text-slate-400'>Seating Grid</span>
                                            <span className='font-semibold text-slate-700'>{hall.rows} Rows × {hall.columns} Cols</span>
                                        </div>
                                    </div>

                                    <div className='space-y-1.5'>
                                        <span className='block text-[10px] uppercase font-bold text-slate-400'>Facilities &amp; Infrastructure</span>
                                        <div className='flex flex-wrap gap-1'>
                                            {hall.facilities.map((fac, idx) => (
                                                <span key={idx} className='text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md'>
                                                    {fac}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* MODAL: Schedule Invigilation Duty */}
                    {showScheduleDutyModal && (
                        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4'>
                            <div className='bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in duration-200'>
                                <div className='flex items-center justify-between border-b border-slate-100 pb-3'>
                                    <h3 className='font-bold text-slate-900 text-base'>Schedule Invigilation Duty</h3>
                                    <button
                                        type='button'
                                        onClick={() => setShowScheduleDutyModal(false)}
                                        className='text-slate-400 hover:text-slate-600 p-1 rounded-lg'
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {dutyConflictError && (
                                    <div className='p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-start gap-2'>
                                        <AlertTriangle size={16} className='text-amber-600 shrink-0 mt-0.5' />
                                        <span>{dutyConflictError}</span>
                                    </div>
                                )}

                                <form onSubmit={handleScheduleDutySubmit} className='space-y-3.5 text-xs font-sans'>
                                    <div>
                                        <label className='block font-bold text-slate-700 mb-1'>Examination Term / Name</label>
                                        <input
                                            type='text'
                                            value={newDutyForm.examName}
                                            onChange={(e) => handleDutyFormChange({ examName: e.target.value })}
                                            className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500'
                                            required
                                        />
                                    </div>

                                    <div className='grid grid-cols-2 gap-3'>
                                        <div>
                                            <label className='block font-bold text-slate-700 mb-1'>Subject</label>
                                            <input
                                                type='text'
                                                value={newDutyForm.subject}
                                                onChange={(e) => handleDutyFormChange({ subject: e.target.value })}
                                                className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500'
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className='block font-bold text-slate-700 mb-1'>Examination Hall</label>
                                            <select
                                                value={newDutyForm.hallId}
                                                onChange={(e) => handleDutyFormChange({ hallId: e.target.value })}
                                                className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500 bg-white'
                                            >
                                                {halls.map((h) => (
                                                    <option key={h.id} value={h.id}>
                                                        {h.hallName} ({h.capacity} seats)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className='grid grid-cols-3 gap-2.5'>
                                        <div>
                                            <label className='block font-bold text-slate-700 mb-1'>Date</label>
                                            <input
                                                type='date'
                                                value={newDutyForm.sessionDate}
                                                onChange={(e) => handleDutyFormChange({ sessionDate: e.target.value })}
                                                className='w-full px-2.5 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500'
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className='block font-bold text-slate-700 mb-1'>Start Time</label>
                                            <select
                                                value={newDutyForm.startTime}
                                                onChange={(e) => handleDutyFormChange({ startTime: e.target.value })}
                                                className='w-full px-2.5 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500 bg-white'
                                            >
                                                <option value='09:00 AM'>09:00 AM</option>
                                                <option value='01:30 PM'>01:30 PM</option>
                                                <option value='02:00 PM'>02:00 PM</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className='block font-bold text-slate-700 mb-1'>End Time</label>
                                            <select
                                                value={newDutyForm.endTime}
                                                onChange={(e) => handleDutyFormChange({ endTime: e.target.value })}
                                                className='w-full px-2.5 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500 bg-white'
                                            >
                                                <option value='12:00 PM'>12:00 PM</option>
                                                <option value='04:30 PM'>04:30 PM</option>
                                                <option value='05:00 PM'>05:00 PM</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className='grid grid-cols-2 gap-3'>
                                        <div>
                                            <label className='block font-bold text-slate-700 mb-1'>Primary Invigilator</label>
                                            <select
                                                value={newDutyForm.primaryInvigilator}
                                                onChange={(e) => handleDutyFormChange({ primaryInvigilator: e.target.value })}
                                                className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500 bg-white'
                                            >
                                                {FACULTY_INVIGILATOR_POOL.map((fac) => (
                                                    <option key={fac.id} value={fac.name}>
                                                        {fac.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className='block font-bold text-slate-700 mb-1'>Reserve Invigilator</label>
                                            <select
                                                value={newDutyForm.reserveInvigilator}
                                                onChange={(e) => handleDutyFormChange({ reserveInvigilator: e.target.value })}
                                                className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500 bg-white'
                                            >
                                                {FACULTY_INVIGILATOR_POOL.map((fac) => (
                                                    <option key={fac.id} value={fac.name}>
                                                        {fac.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className='block font-bold text-slate-700 mb-1'>Candidate Classes / Cohort</label>
                                        <input
                                            type='text'
                                            value={newDutyForm.candidateClasses}
                                            onChange={(e) => handleDutyFormChange({ candidateClasses: e.target.value })}
                                            placeholder='e.g., Grade 10-A, 10-B'
                                            className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500'
                                            required
                                        />
                                    </div>

                                    <div className='pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5'>
                                        <button
                                            type='button'
                                            onClick={() => setShowScheduleDutyModal(false)}
                                            className='px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50'
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type='submit'
                                            disabled={Boolean(dutyConflictError)}
                                            className='px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold shadow-xs'
                                        >
                                            Confirm Duty Allocation
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* MODAL: Add Examination Hall */}
                    {showAddHallModal && (
                        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4'>
                            <div className='bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in duration-200'>
                                <div className='flex items-center justify-between border-b border-slate-100 pb-3'>
                                    <h3 className='font-bold text-slate-900 text-base'>Add Examination Hall</h3>
                                    <button
                                        type='button'
                                        onClick={() => setShowAddHallModal(false)}
                                        className='text-slate-400 hover:text-slate-600 p-1 rounded-lg'
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <form onSubmit={handleAddHallSubmit} className='space-y-3.5 text-xs font-sans'>
                                    <div>
                                        <label className='block font-bold text-slate-700 mb-1'>Hall Name</label>
                                        <input
                                            type='text'
                                            value={newHallForm.hallName}
                                            onChange={(e) => setNewHallForm({ ...newHallForm, hallName: e.target.value })}
                                            placeholder='e.g., Auditorium Hall 4'
                                            className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500'
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className='block font-bold text-slate-700 mb-1'>Wing / Complex Location</label>
                                        <input
                                            type='text'
                                            value={newHallForm.wingBlock}
                                            onChange={(e) => setNewHallForm({ ...newHallForm, wingBlock: e.target.value })}
                                            placeholder='e.g., South Wing (Level 3)'
                                            className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500'
                                            required
                                        />
                                    </div>

                                    <div className='grid grid-cols-3 gap-2.5'>
                                        <div>
                                            <label className='block font-bold text-slate-700 mb-1'>Rows</label>
                                            <input
                                                type='number'
                                                min='1'
                                                max='20'
                                                value={newHallForm.rows}
                                                onChange={(e) => {
                                                    const r = Number(e.target.value) || 1
                                                    setNewHallForm({
                                                        ...newHallForm,
                                                        rows: r,
                                                        capacity: r * newHallForm.columns,
                                                    })
                                                }}
                                                className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500'
                                            />
                                        </div>
                                        <div>
                                            <label className='block font-bold text-slate-700 mb-1'>Columns</label>
                                            <input
                                                type='number'
                                                min='1'
                                                max='20'
                                                value={newHallForm.columns}
                                                onChange={(e) => {
                                                    const c = Number(e.target.value) || 1
                                                    setNewHallForm({
                                                        ...newHallForm,
                                                        columns: c,
                                                        capacity: newHallForm.rows * c,
                                                    })
                                                }}
                                                className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500'
                                            />
                                        </div>
                                        <div>
                                            <label className='block font-bold text-slate-700 mb-1'>Capacity</label>
                                            <input
                                                type='number'
                                                value={newHallForm.capacity}
                                                onChange={(e) => setNewHallForm({ ...newHallForm, capacity: Number(e.target.value) || 0 })}
                                                className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500'
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className='block font-bold text-slate-700 mb-1.5'>Facilities</label>
                                        <div className='grid grid-cols-2 gap-2 text-slate-700'>
                                            {['CCTV Surveillance', 'Central Air Conditioning', 'Biometric Verification', 'Wheelchair Ramp Access'].map((fac) => {
                                                const checked = newHallForm.facilities.includes(fac)
                                                return (
                                                    <label key={fac} className='flex items-center gap-2 cursor-pointer'>
                                                        <input
                                                            type='checkbox'
                                                            checked={checked}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setNewHallForm({ ...newHallForm, facilities: [...newHallForm.facilities, fac] })
                                                                } else {
                                                                    setNewHallForm({ ...newHallForm, facilities: newHallForm.facilities.filter((f) => f !== fac) })
                                                                }
                                                            }}
                                                            className='rounded text-blue-600 focus:ring-blue-500'
                                                        />
                                                        <span>{fac}</span>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className='pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5'>
                                        <button
                                            type='button'
                                            onClick={() => setShowAddHallModal(false)}
                                            className='px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50'
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type='submit'
                                            className='px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs'
                                        >
                                            Save Hall
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showCreateExamModal && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4'>
                    <div className='bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in duration-200'>
                        <div className='flex items-center justify-between border-b border-slate-100 pb-3'>
                            <h3 className='font-bold text-slate-900 text-base'>Schedule Examination</h3>
                            <button
                                type='button'
                                onClick={() => setShowCreateExamModal(false)}
                                className='text-slate-400 hover:text-slate-600 p-1 rounded-lg'
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <p className='text-xs text-slate-500'>
                            Persists via POST /api/v1/exams then submit. Requires exams.write. Success only after server confirmation.
                        </p>
                        {createError ? (
                            <div className='p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold'>
                                {createError}
                            </div>
                        ) : null}
                        <form onSubmit={handleCreateExamSubmit} className='space-y-3 text-xs'>
                            <div>
                                <label className='block font-bold text-slate-700 mb-1'>Examination name</label>
                                <input
                                    type='text'
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                    className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-blue-500'
                                    required
                                />
                            </div>
                            <div className='grid grid-cols-2 gap-3'>
                                <div>
                                    <label className='block font-bold text-slate-700 mb-1'>Exam type</label>
                                    <select
                                        value={createForm.examType}
                                        onChange={(e) => setCreateForm({ ...createForm, examType: e.target.value })}
                                        className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold bg-white'
                                    >
                                        <option value='MIDTERM'>MIDTERM</option>
                                        <option value='FINAL'>FINAL</option>
                                        <option value='UNIT'>UNIT</option>
                                        <option value='PREBOARD'>PREBOARD</option>
                                    </select>
                                </div>
                                <div>
                                    <label className='block font-bold text-slate-700 mb-1'>Class</label>
                                    <input
                                        type='text'
                                        value={createForm.className}
                                        onChange={(e) => setCreateForm({ ...createForm, className: e.target.value })}
                                        className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold'
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className='block font-bold text-slate-700 mb-1'>Academic year</label>
                                <input
                                    type='text'
                                    value={createForm.academicYear}
                                    onChange={(e) => setCreateForm({ ...createForm, academicYear: e.target.value })}
                                    className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold'
                                />
                            </div>
                            <div className='grid grid-cols-2 gap-3'>
                                <div>
                                    <label className='block font-bold text-slate-700 mb-1'>Start date</label>
                                    <input
                                        type='date'
                                        value={createForm.startDate}
                                        onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                                        className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold'
                                        required
                                    />
                                </div>
                                <div>
                                    <label className='block font-bold text-slate-700 mb-1'>End date</label>
                                    <input
                                        type='date'
                                        value={createForm.endDate}
                                        onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                                        className='w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold'
                                        required
                                    />
                                </div>
                            </div>
                            <div className='pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5'>
                                <button
                                    type='button'
                                    onClick={() => setShowCreateExamModal(false)}
                                    className='px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='submit'
                                    disabled={createSaving}
                                    className='px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold shadow-xs'
                                >
                                    {createSaving ? 'Saving…' : 'Save on server'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    )
}

export default EnterpriseExamManagementPage

