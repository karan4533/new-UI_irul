import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
    Award,
    Trophy,
    Star,
    Calendar,
    Users,
    Building2,
    CheckCircle2,
    Clock,
    Plus,
    Filter,
    Search,
    ChevronRight,
    Calculator,
    ShieldCheck,
    Lock,
    Sparkles,
    Download,
    FileSpreadsheet,
    FileText,
    ArrowUpRight,
    X,
    ThumbsUp,
    Printer,
    Check,
    AlertCircle,
    UserCheck,
    Edit3
} from 'lucide-react'
import { toast } from 'react-toastify'
import { DataSourceIndicator } from '../ui'
import { useAuth } from '../../context/AuthContext'
import { getProfileLabel } from '../../Pages/Authentication/profileOptions'
import BulkClassSectionSelector from './Components/BulkClassSectionSelector'
import DepartmentEmployeeSelector from './Components/DepartmentEmployeeSelector'
import RecognitionModalOverlay from './Components/RecognitionModalOverlay'
import { openPrintDocument } from '../printDocument'
import { awardsService } from '../../services/modules/awardsService'
import {
    deriveCumulativeGpa10,
    evaluateMandatorySoyGates,
} from '../../services/modules/soyEligibility'
import {
    ACADEMIC_YEARS,
    CURRENT_ACADEMIC_YEAR,
    RECOGNITION_MONTHS,
    CURRENT_MONTH,
    getAcademicSomRecords,
    saveAcademicSomRecord,
    getNonAcademicSomRecords,
    saveNonAcademicSomRecord,
    calculateAcademicStarOfYear,
    calculateNonAcademicStarOfYear,
    CLASS_ASSIGNMENTS,
    NON_ACADEMIC_DEPARTMENTS
} from './recognitionData'

const resolveRecognitionPath = (pathname, type) => {
    if (!pathname) return null
    if (type === 'soy') {
        if (pathname.includes('star-of-month')) return pathname.replace('star-of-month', 'star-of-year')
        if (pathname.includes('star-of-the-month')) return pathname.replace('star-of-the-month', 'star-of-year')
        return null
    }
    if (pathname.includes('star-of-year')) return pathname.replace('star-of-year', 'star-of-month')
    return null
}

const EnterpriseRecognitionPage = ({ view = 'som', defaultDomain }) => {
    const { role: userRole, email: userEmail, name: authName } = useAuth()
    const roleLabel = getProfileLabel(userRole)
    const navigate = useNavigate()
    const location = useLocation()

    const isNonAcademicRole = [
        'hr', 'stationery-store-manager', 'transport-manager', 'canteen-manager',
        'it-support-manager', 'housekeeping-manager', 'gate-keeper', 'gatekeeper-manager',
        'account-head', 'driver', 'van-driver', 'maintenancemanager', 'maintenance-manager',
        'maintenance'
    ].includes(userRole)

    const isAcademicRole = [
        'teacher', 'coordinator', 'principal', 'joint-director', 'joint-director-assistant',
        'student', 'librarian'
    ].includes(userRole)

    const initialDomain = defaultDomain || (isNonAcademicRole ? 'non_academic' : 'academic')

    // Domain state
    const [domain, setDomain] = useState(initialDomain) // 'academic' | 'non_academic'
    // Local fallback only when the current route cannot express SOM/SOY (e.g. maintenance SOM-only path)
    const [localRecognitionType, setLocalRecognitionType] = useState(view === 'soy' ? 'soy' : 'som')
    const routeCanToggleRecognition = /star-of-(month|year)|star-of-the-month/.test(location.pathname || '')
    const recognitionType = routeCanToggleRecognition
        ? (view === 'soy' ? 'soy' : 'som')
        : localRecognitionType

    const handleRecognitionTypeChange = useCallback((type) => {
        const nextPath = resolveRecognitionPath(location.pathname, type)
        if (nextPath && nextPath !== location.pathname) {
            navigate(nextPath)
            return
        }
        setLocalRecognitionType(type)
    }, [location.pathname, navigate])

    // Strict department scoping: lock domain when defaultDomain is provided OR role is department-specific
    const isDomainLocked = Boolean(defaultDomain) || (!['superadmin', 'admin', 'director'].includes(userRole))

    useEffect(() => {
        setLocalRecognitionType(view === 'soy' ? 'soy' : 'som')
    }, [view])

    useEffect(() => {
        if (defaultDomain) {
            setDomain(defaultDomain)
        } else if (isNonAcademicRole) {
            setDomain('non_academic')
        } else if (isAcademicRole) {
            setDomain('academic')
        }
    }, [defaultDomain, isNonAcademicRole, isAcademicRole])

    // Filters
    const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH)
    const [selectedAcademicYear, setSelectedAcademicYear] = useState(CURRENT_ACADEMIC_YEAR)
    const [searchQuery, setSearchQuery] = useState('')
    const [somStatusFilter, setSomStatusFilter] = useState('ALL') // 'ALL' | 'Submitted for Review' | 'Reviewed' | 'Announced Winner'

    // Service state
    const [serviceSomList, setServiceSomList] = useState([])
    const [serviceSoyList, setServiceSoyList] = useState([])
    const [serviceRefreshKey, setServiceRefreshKey] = useState(0)

    // Nomination Modals
    const [isNominateModalOpen, setIsNominateModalOpen] = useState(false)
    const [nominationClassKeys, setNominationClassKeys] = useState(['Grade 10-A'])
    const [nominationDeptIds, setNominationDeptIds] = useState(['dept-stores'])
    const [selectedCandidate, setSelectedCandidate] = useState(null)
    const [citationText, setCitationText] = useState('')
    const [customScore, setCustomScore] = useState(98)
    const [actionMessage, setActionMessage] = useState('')

    // SOM Separate Marks Calculation Rubric for Academic (0 - 20 marks each = 100 max)
    const [academicRubricScores, setAcademicRubricScores] = useState({
        scholasticExcellence: 20,
        punctuality: 20,
        classroomHygiene: 20,
        peerMentoring: 20,
        valuesAndEthics: 20,
    })

    // SOM Separate Marks Calculation Rubric for Non-Academic (0 - 20 marks each = 100 max)
    const [nonAcademicRubricScores, setNonAcademicRubricScores] = useState({
        punctualityReliability: 20,
        operationalDiligence: 20,
        equipmentUpkeepSafety: 20,
        turnaroundSpeed: 20,
        cooperationTeamwork: 20,
    })

    const activeRubric = domain === 'academic' ? academicRubricScores : nonAcademicRubricScores

    const totalRubricScore = useMemo(() => {
        return Object.values(activeRubric).reduce((sum, val) => sum + Number(val || 0), 0)
    }, [activeRubric])

    const rubricPercentage = useMemo(() => {
        return Math.min(100, Math.max(0, Math.round(totalRubricScore)))
    }, [totalRubricScore])

    const rubricTier = useMemo(() => {
        if (rubricPercentage >= 90) return { label: 'Outstanding (3 Stars)', stars: 3, color: 'bg-emerald-100 text-emerald-800' }
        if (rubricPercentage >= 80) return { label: 'Exemplary (2 Stars)', stars: 2, color: 'bg-blue-100 text-blue-800' }
        return { label: 'Satisfactory (1 Star)', stars: 1, color: 'bg-amber-100 text-amber-800' }
    }, [rubricPercentage])

    // SOY 4-Tier Candidate Audit Modal
    const [soyAuditModalOpen, setSoyAuditModalOpen] = useState(false)
    const [selectedCandForAudit, setSelectedCandForAudit] = useState(null)

    // SOM Review Modal State
    const [reviewModalOpen, setReviewModalOpen] = useState(false)
    const [selectedSomForReview, setSelectedSomForReview] = useState(null)
    const [reviewRemarks, setReviewRemarks] = useState('Recommended for Star of the Month recognition.')

    // SOY Separate Form & Marks Calculation State
    const [soyScoreModalOpen, setSoyScoreModalOpen] = useState(false)
    const [selectedSoyForScore, setSelectedSoyForScore] = useState(null)
    const [soyFormScores, setSoyFormScores] = useState({
        monthlyConsistency: 28,      // Max 30 Marks
        annualAttendance: 19,        // Max 20 Marks
        milestoneLeadership: 24,     // Max 25 Marks
        disciplinaryStanding: 10,    // Max 10 Marks
        committeeJuryScore: 14,      // Max 15 Marks
    })
    const [committeeRemarks, setCommitteeRemarks] = useState('Exemplary leadership, annual performance excellence and institutional conduct.')

    const totalSoyScore = useMemo(() => {
        return (
            Number(soyFormScores.monthlyConsistency || 0) +
            Number(soyFormScores.annualAttendance || 0) +
            Number(soyFormScores.milestoneLeadership || 0) +
            Number(soyFormScores.disciplinaryStanding || 0) +
            Number(soyFormScores.committeeJuryScore || 0)
        )
    }, [soyFormScores])

    // SOY MD Sign-Off Modal
    const [mdSignOffModalOpen, setMdSignOffModalOpen] = useState(false)
    const [selectedSoyForMd, setSelectedSoyForMd] = useState(null)
    const [mdRemarks, setMdRemarks] = useState('Approved for annual institutional citation and Star of the Year rolling trophy.')
    const [officialCitation, setOfficialCitation] = useState('In recognition of outstanding academic brilliance, peer leadership, and sterling character.')

    // Load persisted service data
    useEffect(() => {
        const loadAwards = async () => {
            try {
                const [somRes, soyRes] = await Promise.all([
                    awardsService.getSomNominations(),
                    awardsService.getSoyNominations()
                ])
                if (somRes?.success && Array.isArray(somRes.data)) {
                    setServiceSomList(somRes.data)
                }
                if (soyRes?.success && Array.isArray(soyRes.data)) {
                    setServiceSoyList(soyRes.data)
                }
            } catch (err) {
                console.warn('Could not load awards service data:', err)
            }
        }
        loadAwards()
    }, [serviceRefreshKey])

    // Data queries for local records
    const academicSomRecords = useMemo(() => getAcademicSomRecords(), [actionMessage])
    const nonAcademicSomRecords = useMemo(() => getNonAcademicSomRecords(), [actionMessage])

    const academicSoyRankings = useMemo(
        () => calculateAcademicStarOfYear(selectedAcademicYear),
        [selectedAcademicYear, actionMessage]
    )

    const nonAcademicSoyRankings = useMemo(
        () => calculateNonAcademicStarOfYear(selectedAcademicYear),
        [selectedAcademicYear, actionMessage]
    )

    // Filtered monthly records
    const filteredAcademicSom = useMemo(() => {
        return academicSomRecords.filter((r) => {
            const matchesMonth = !selectedMonth || r.month === selectedMonth
            const matchesYear = !selectedAcademicYear || r.academicYear === selectedAcademicYear
            const matchesStatus = somStatusFilter === 'ALL' || r.status === somStatusFilter
            const q = searchQuery.trim().toLowerCase()
            const matchesSearch = !q ||
                r.studentName?.toLowerCase().includes(q) ||
                r.classSection?.toLowerCase().includes(q) ||
                r.studentId?.toLowerCase().includes(q)
            return matchesMonth && matchesYear && matchesStatus && matchesSearch
        })
    }, [academicSomRecords, selectedMonth, selectedAcademicYear, somStatusFilter, searchQuery])

    const filteredNonAcademicSom = useMemo(() => {
        return nonAcademicSomRecords.filter((r) => {
            const matchesMonth = !selectedMonth || r.month === selectedMonth
            const matchesYear = !selectedAcademicYear || r.academicYear === selectedAcademicYear
            const matchesStatus = somStatusFilter === 'ALL' || r.status === somStatusFilter
            const q = searchQuery.trim().toLowerCase()
            const matchesSearch = !q ||
                r.employeeName?.toLowerCase().includes(q) ||
                r.department?.toLowerCase().includes(q) ||
                r.employeeId?.toLowerCase().includes(q)
            return matchesMonth && matchesYear && matchesStatus && matchesSearch
        })
    }, [nonAcademicSomRecords, selectedMonth, selectedAcademicYear, somStatusFilter, searchQuery])

    // Handlers
    const handleOpenNominate = () => {
        setSelectedCandidate(null)
        setCitationText('')
        setCustomScore(98)
        setAcademicRubricScores({
            scholasticExcellence: 20,
            punctuality: 20,
            classroomHygiene: 20,
            peerMentoring: 20,
            valuesAndEthics: 20,
        })
        setNonAcademicRubricScores({
            punctualityReliability: 20,
            operationalDiligence: 20,
            equipmentUpkeepSafety: 20,
            turnaroundSpeed: 20,
            cooperationTeamwork: 20,
        })
        setIsNominateModalOpen(true)
    }

    const handleSubmitNomination = async (e) => {
        e.preventDefault()
        if (!selectedCandidate) {
            alert('Please select a candidate first.')
            return
        }

        const nominatedByLabel = `${authName || roleLabel} (${roleLabel})`
        const activeRubricData = domain === 'academic' ? academicRubricScores : nonAcademicRubricScores

        // 1. Submit through domain service awardsService.nominateSom
        try {
            await awardsService.nominateSom({
                month: selectedMonth,
                category: domain === 'academic' ? 'ACADEMIC' : 'NON_ACADEMIC',
                nomineeId: selectedCandidate.id,
                nomineeName: selectedCandidate.name,
                nominatedById: authName || 'EMP-TCH-001',
                nominatedByName: nominatedByLabel,
                grade: selectedCandidate.classKey || 'Grade 10',
                section: (selectedCandidate.classKey || 'Grade 10-A').split('-')[1] || 'A',
                department: selectedCandidate.deptName || 'Stores & Procurement',
                citationText: citationText.trim() || 'Recognized for sterling performance and dedication.',
                checklistScores: activeRubricData,
                totalScore: totalRubricScore,
            })
        } catch (serviceErr) {
            console.warn('awardsService.nominateSom notice:', serviceErr)
        }

        // 2. Also record in local storage
        if (domain === 'academic') {
            const newRecord = {
                id: `ASOM-${Date.now()}`,
                month: selectedMonth,
                academicYear: selectedAcademicYear,
                classSection: selectedCandidate.classKey || 'Grade 10-A',
                className: (selectedCandidate.classKey || 'Grade 10-A').split('-')[0],
                section: (selectedCandidate.classKey || 'Grade 10-A').split('-')[1] || 'A',
                studentId: selectedCandidate.id,
                studentName: selectedCandidate.name,
                gpa: selectedCandidate.gpa || 3.92,
                score: rubricPercentage,
                rubricMarks: totalRubricScore,
                categoryMarks: { ...academicRubricScores },
                ratingStars: rubricTier.stars,
                citation: citationText.trim() || selectedCandidate.citation || 'Recognized for consistent academic and co-curricular excellence.',
                status: 'Submitted for Review',
                nominatedBy: nominatedByLabel,
                finalizedAt: new Date().toISOString().split('T')[0],
            }
            saveAcademicSomRecord(newRecord)
            setActionMessage(`Academic Star of the Month nomination submitted for ${newRecord.studentName} (${newRecord.classSection}).`)
            toast.success(`Academic nomination for ${newRecord.studentName} submitted with calculated score ${totalRubricScore}/100!`)
        } else {
            const newRecord = {
                id: `NASOM-${Date.now()}`,
                month: selectedMonth,
                academicYear: selectedAcademicYear,
                department: selectedCandidate.deptName || 'Campus Infrastructure & Maintenance',
                employeeId: selectedCandidate.id,
                employeeName: selectedCandidate.name,
                designation: selectedCandidate.designation,
                kpiScore: rubricPercentage,
                rubricMarks: totalRubricScore,
                categoryMarks: { ...nonAcademicRubricScores },
                ratingStars: rubricTier.stars,
                citation: citationText.trim() || selectedCandidate.citation || 'Recognized for exceptional non-academic dedication and operational diligence.',
                status: 'Submitted for Review',
                nominatedBy: nominatedByLabel,
                finalizedAt: new Date().toISOString().split('T')[0],
            }
            saveNonAcademicSomRecord(newRecord)
            setActionMessage(`Non-Academic Star of the Month nomination submitted for ${newRecord.employeeName} (${newRecord.department}).`)
            toast.success(`Non-Academic nomination for ${newRecord.employeeName} submitted with calculated score ${totalRubricScore}/100!`)
        }

        setIsNominateModalOpen(false)
        setServiceRefreshKey((k) => k + 1)
        setTimeout(() => setActionMessage(''), 4000)
    }

    // Review & Endorse SOM
    const handleConfirmSomReview = async () => {
        if (!selectedSomForReview) return
        try {
            await awardsService.reviewSom(selectedSomForReview.id, {
                status: 'Reviewed',
                reviewRemarks,
                reviewerName: authName || 'Coordinator',
            })
            // Update local record status
            selectedSomForReview.status = 'Reviewed'
            selectedSomForReview.reviewRemarks = reviewRemarks
            if (domain === 'academic') {
                saveAcademicSomRecord(selectedSomForReview)
            } else {
                saveNonAcademicSomRecord(selectedSomForReview)
            }
            toast.success(`✓ Star of the Month nomination reviewed & endorsed! Ready for Principal announcement.`)
            setReviewModalOpen(false)
            setSelectedSomForReview(null)
            setServiceRefreshKey((k) => k + 1)
        } catch (err) {
            toast.error(err.message || 'Error reviewing nomination.')
        }
    }

    // Announce SOM Winner
    const handleAnnounceSomWinner = async (record) => {
        try {
            await awardsService.announceSomWinner(record.id)
            record.status = 'Announced Winner'
            record.announcedDate = new Date().toISOString().split('T')[0]
            if (domain === 'academic') {
                saveAcademicSomRecord(record)
            } else {
                saveNonAcademicSomRecord(record)
            }
            toast.success(`🏆 Winner announced! ${record.studentName || record.employeeName} is officially Star of the Month (${record.month}).`)
            setServiceRefreshKey((k) => k + 1)
        } catch (err) {
            toast.error(err.message || 'Error announcing winner.')
        }
    }

    // Nominate Candidate for Star of the Year — same mandatory gates as leaderboard / Audit Gates
    const handleNominateForSoy = async (candidate) => {
        try {
            const gpaParsed = deriveCumulativeGpa10(candidate)
            const attendanceRaw = candidate.attendance
            const infractionsRaw = candidate.infractions ?? 0
            const localCheck = evaluateMandatorySoyGates({
                somWinsCount: candidate.somCount,
                cumulativeGpa: gpaParsed.ok ? gpaParsed.value : null,
                attendancePercentage: attendanceRaw,
                infractions: infractionsRaw,
            })
            if (!localCheck.isEligible) {
                const detail = localCheck.failedCriteria.map((g) => g.reason).join('; ')
                toast.warning(`Cannot nominate — ${detail}`)
                return
            }

            const payload = {
                academicYear: selectedAcademicYear,
                nomineeId: candidate.studentId || candidate.employeeId,
                nomineeName: candidate.studentName || candidate.employeeName,
                grade: candidate.classSection || candidate.department || 'Grade 10-A',
                cumulativeGpa: gpaParsed.value,
                attendancePercentage: attendanceRaw,
                infractions: infractionsRaw,
                somWinsCount: candidate.somCount,
            }

            const res = await awardsService.nominateSoy(payload)
            if (res.success) {
                toast.success(`✓ ${payload.nomineeName} nominated for Star of the Year Committee Review!`)
                setSoyAuditModalOpen(false)
                setSelectedCandForAudit(null)
                setServiceRefreshKey((k) => k + 1)
            } else {
                toast.warning(res.error || 'Nominee did not meet criteria.')
            }
        } catch (err) {
            toast.error(err.message || 'Error creating SOY nomination.')
        }
    }

    // Open SOY Committee Scoring Form with dynamic pre-calculations
    const handleOpenSoyScoring = (soyItem) => {
        setSelectedSoyForScore(soyItem)
        const somAvg = Number(soyItem.avgScore || soyItem.avgKpi || 92)
        const att = Number(soyItem.attendance || 97)
        setSoyFormScores({
            monthlyConsistency: Math.min(30, Math.max(0, Math.round((somAvg / 100) * 30))),
            annualAttendance: Math.min(20, Math.max(0, Math.round((att / 100) * 20))),
            milestoneLeadership: 24,
            disciplinaryStanding: 10,
            committeeJuryScore: 14,
        })
        setCommitteeRemarks(
            domain === 'academic'
                ? 'Exemplary scholastic brilliance, active peer leadership, and consistent conduct.'
                : 'Outstanding operational efficiency, zero breakdown record, and strong teamwork.'
        )
        setSoyScoreModalOpen(true)
    }

    // Submit Committee Evaluation Score for SOY using separate marks calculation form
    const handleConfirmSoyScore = async () => {
        if (!selectedSoyForScore) return
        try {
            const res = await awardsService.evaluateSoyCommittee(selectedSoyForScore.id, {
                score: Number(totalSoyScore),
                remarks: committeeRemarks,
                recommendedBy: `${authName || 'Executive Panel'} (Committee)`,
                categoryScores: { ...soyFormScores },
            })
            if (res.success) {
                toast.success(`✓ Committee evaluation score of ${totalSoyScore}/100 recorded for ${selectedSoyForScore.nomineeName}! Forwarded for MD Sign-Off.`)
                setSoyScoreModalOpen(false)
                setSelectedSoyForScore(null)
                setServiceRefreshKey((k) => k + 1)
            }
        } catch (err) {
            toast.error(err.message || 'Error submitting committee evaluation.')
        }
    }

    // Submit MD Final Sign-Off for SOY
    const handleConfirmMdSignOff = async (approved) => {
        if (!selectedSoyForMd) return
        try {
            const res = await awardsService.approveSoyByMd(selectedSoyForMd.id, {
                approved,
                mdRemarks,
                citationText: officialCitation,
            })
            if (res.success) {
                if (approved) {
                    toast.success(`🏆 Managing Director Final Sanction Approved! ${selectedSoyForMd.nomineeName} is awarded Star of the Year (${selectedAcademicYear})!`)
                } else {
                    toast.info(`Nomination declined by MD.`)
                }
                setMdSignOffModalOpen(false)
                setSelectedSoyForMd(null)
                setServiceRefreshKey((k) => k + 1)
            }
        } catch (err) {
            toast.error(err.message || 'Error processing MD sign-off.')
        }
    }

    // Safe HTML Escaper for Print Citation
    const escapeHtml = (str) =>
        String(str ?? '').replace(
            /[&<>"']/g,
            (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
        )

    // Print Citation Certificate
    const handlePrintCitation = (soyWinner) => {
        const body = `
            <div style="padding:40px;text-align:center;font-family:serif;border:10px double #B45309;background:#FFFDF7;">
                <h2 style="font-size:24px;text-transform:uppercase;letter-spacing:2px;color:#92400E;margin-bottom:4px;">Queens Matriculation & Higher Secondary School</h2>
                <h4 style="font-size:14px;color:#78350F;text-transform:uppercase;margin-top:0;">Board of Trustees & Academic Council</h4>
                <div style="font-size:48px;margin:20px 0;">🏆</div>
                <h1 style="font-size:32px;color:#B45309;margin-bottom:8px;font-family:sans-serif;font-weight:900;">STAR OF THE YEAR AWARD</h1>
                <p style="font-size:16px;color:#451A03;margin:0;">Academic Session: ${escapeHtml(soyWinner.academicYear || selectedAcademicYear)}</p>
                <p style="margin:30px auto;max-width:600px;font-size:18px;line-height:1.6;color:#1F2937;">
                    This premier institutional honor is conferred upon
                    <br><strong style="font-size:28px;color:#1E3A8A;display:block;margin:12px 0;">${escapeHtml(soyWinner.nomineeName || 'Aarav Sharma')}</strong>
                    ${escapeHtml(soyWinner.grade || 'Grade 10-A')}
                    <br><br>
                    <em>"${escapeHtml(soyWinner.citation || 'In recognition of outstanding academic brilliance, peer leadership, and sterling character.')}"</em>
                </p>
                <div style="margin-top:50px;display:flex;justify-content:space-around;font-family:sans-serif;font-size:12px;color:#4B5563;">
                    <div>_______________________<br>Principal / Dean</div>
                    <div>_______________________<br>Joint Director</div>
                    <div>_______________________<br>Managing Director</div>
                </div>
            </div>
        `
        openPrintDocument({ title: `Star of the Year Citation - ${escapeHtml(soyWinner.nomineeName)}`, body })
    }

    const isSupervisor = ['director', 'principal', 'coordinator', 'superadmin', 'admin'].includes(userRole)
    const isDirectorOrAdmin = ['director', 'superadmin', 'admin'].includes(userRole)

    return (
        <section className="space-y-6 pb-10 font-sans max-w-7xl mx-auto p-4 sm:p-6">
            <DataSourceIndicator
                status='MOCK'
                detail='Star Ratings / SOM / SOY use awardsService and local recognition data. There is no dedicated FastAPI awards domain.'
            />
            {/* Top Workspace Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Institutional Recognition & Performance Awards
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                            Star Ratings
                        </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                        Separate, auditable workflows for Star of the Month (SOM) and Star of the Year (SOY) backed by awardsService.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={handleOpenNominate}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                        <Plus size={14} />
                        <span>Nominate Star of the Month</span>
                    </button>
                </div>
            </div>

            {/* Notification message banner */}
            {actionMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{actionMessage}</span>
                </div>
            )}

            {/* Main Category and Recognition Type Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-white rounded-2xl border border-slate-200 shadow-xs">
                {/* Recognition Tier (SOM vs SOY) */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => handleRecognitionTypeChange('som')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            recognitionType === 'som'
                                ? 'bg-white text-blue-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Star size={14} className={recognitionType === 'som' ? 'text-amber-500 fill-amber-500' : ''} />
                        <span>Star of the Month (Monthly)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleRecognitionTypeChange('soy')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            recognitionType === 'soy'
                                ? 'bg-white text-amber-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Trophy size={14} className={recognitionType === 'soy' ? 'text-amber-600 fill-amber-600' : ''} />
                        <span>Star of the Year (Annual & MD Sign-off)</span>
                    </button>
                </div>

                {/* Department Domain Scoping: Strict separation for Academic vs Non-Academic */}
                {isDomainLocked ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-xs">
                        {domain === 'academic' ? (
                            <div className="flex items-center gap-1.5 text-blue-900 bg-blue-50/80 px-3 py-1 rounded-lg border border-blue-200">
                                <Users size={14} className="text-blue-600" />
                                <span>Academic Department (Students)</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-purple-900 bg-purple-50/80 px-3 py-1 rounded-lg border border-purple-200">
                                <Building2 size={14} className="text-purple-600" />
                                <span>Non-Academic Department (Staff)</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setDomain('academic')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                domain === 'academic'
                                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Users size={14} />
                            <span>Academic (Students)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setDomain('non_academic')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                domain === 'non_academic'
                                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Building2 size={14} />
                            <span>Non-Academic (Staff)</span>
                        </button>
                    </div>
                )}
            </div>

            {/* ============================================================== */}
            {/* VIEW 1: STAR OF THE MONTH (SOM) WORKFLOW                      */}
            {/* ============================================================== */}
            {recognitionType === 'som' && (
                <div className="space-y-6">
                    {/* Filter Bar */}
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Recognition Month
                                </label>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-800"
                                >
                                    {RECOGNITION_MONTHS.map((m) => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Workflow Stage
                                </label>
                                <select
                                    value={somStatusFilter}
                                    onChange={(e) => setSomStatusFilter(e.target.value)}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-800"
                                >
                                    <option value="ALL">All Stages</option>
                                    <option value="Submitted for Review">Submitted for Review</option>
                                    <option value="Reviewed">Reviewed & Endorsed</option>
                                    <option value="Announced Winner">Announced Winners</option>
                                    <option value="Published">Published</option>
                                </select>
                            </div>
                        </div>

                        <div className="relative w-full sm:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search candidate..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>

                    {/* Table of Monthly Nominations & Awards */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Award size={18} className="text-blue-600" />
                                {domain === 'academic' ? 'Student Star of the Month Roster' : 'Employee Star of the Month Roster'}
                            </h3>
                            <span className="text-xs text-slate-500">
                                Month: {selectedMonth} • {domain === 'academic' ? filteredAcademicSom.length : filteredNonAcademicSom.length} Nominations
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="py-3 px-4">Candidate Name & ID</th>
                                        <th className="py-3 px-4">{domain === 'academic' ? 'Class & Section' : 'Department'}</th>
                                        <th className="py-3 px-4 text-center">Score</th>
                                        <th className="py-3 px-4">Citation & Remarks</th>
                                        <th className="py-3 px-4">Nominated By</th>
                                        <th className="py-3 px-4 text-center">Stage / Status</th>
                                        <th className="py-3 px-4 text-right">Workflow Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {(domain === 'academic' ? filteredAcademicSom : filteredNonAcademicSom).map((rec) => {
                                        const isAnnounced = rec.status === 'Announced Winner' || rec.status === 'Published'
                                        const isReviewed = rec.status === 'Reviewed'
                                        const isSubmitted = rec.status === 'Submitted for Review' || !rec.status

                                        return (
                                            <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-3.5 px-4">
                                                    <span className="font-bold text-slate-900 block">{rec.studentName || rec.employeeName}</span>
                                                    <span className="text-[11px] text-slate-400 font-mono">{rec.studentId || rec.employeeId}</span>
                                                </td>
                                                <td className="py-3.5 px-4 font-semibold text-slate-800">
                                                    {rec.classSection || rec.department}
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className="font-bold text-blue-700">{rec.score || rec.kpiScore || 98}%</span>
                                                </td>
                                                <td className="py-3.5 px-4 max-w-xs text-xs text-slate-600 truncate" title={rec.citation}>
                                                    {rec.citation}
                                                </td>
                                                <td className="py-3.5 px-4 text-xs text-slate-500">
                                                    {rec.nominatedBy || 'Class Teacher'}
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                                        isAnnounced ? 'bg-amber-100 text-amber-800' :
                                                        isReviewed ? 'bg-indigo-100 text-indigo-800' :
                                                        'bg-blue-50 text-blue-800'
                                                    }`}>
                                                        {rec.status || 'Submitted for Review'}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {isSubmitted && isSupervisor && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedSomForReview(rec)
                                                                    setReviewModalOpen(true)
                                                                }}
                                                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                                                            >
                                                                Review & Endorse
                                                            </button>
                                                        )}
                                                        {!isAnnounced && isSupervisor && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAnnounceSomWinner(rec)}
                                                                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                                                            >
                                                                <Trophy size={12} />
                                                                Announce Winner
                                                            </button>
                                                        )}
                                                        {isAnnounced && (
                                                            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                                                                <Check size={14} /> Winner Announced
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* VIEW 2: STAR OF THE YEAR (SOY) WORKFLOW                       */}
            {/* ============================================================== */}
            {recognitionType === 'soy' && (
                <div className="space-y-6">
                    {/* Annual Criteria and Executive Governance Banner */}
                    <div className="p-5 rounded-2xl bg-linear-to-r from-amber-500/10 via-amber-400/15 to-transparent border border-amber-200">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5">
                                    <Trophy size={22} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Star of the Year: Annual Institutional Trophy & MD Sign-off
                                    </h3>
                                    <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                                        Mandatory Criteria: <b>≥ 2 Monthly SOM Wins</b> • Cumulative GPA <b>≥ 8.5</b> • Annual Attendance <b>≥ 95%</b> • <b>Zero Disciplinary Infractions</b>. Requires Committee Evaluation & Managing Director Final Sign-off.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 1: Candidate Leaderboard & Eligibility Scan */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Trophy size={18} className="text-amber-500" />
                                <h3 className="text-sm font-bold text-slate-900">
                                    Annual Candidate Leaderboard & Eligibility Evaluation
                                </h3>
                            </div>
                            <span className="text-xs text-slate-400">
                                Academic Session: {selectedAcademicYear}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-[1100px] w-full text-left text-xs table-fixed">
                                <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="py-3 px-4 w-16">Rank</th>
                                        <th className="py-3 px-4 w-[180px]">Candidate & Profile</th>
                                        <th className="py-3 px-4 w-[140px]">{domain === 'academic' ? 'Class & Section' : 'Department'}</th>
                                        <th className="py-3 px-4 w-[120px] text-center">Monthly Recognitions</th>
                                        <th className="py-3 px-4 w-[110px] text-center">Avg Monthly Score</th>
                                        <th className="py-3 px-4 w-[100px] text-center">Attendance</th>
                                        <th className="py-3 px-4 w-[110px] text-center">Cumulative Score</th>
                                        <th className="py-3 px-4 w-[220px] text-center">Eligibility Status</th>
                                        <th className="py-3 px-4 w-[260px] text-right">Committee Nomination</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {(domain === 'academic' ? academicSoyRankings : nonAcademicSoyRankings).map((cand) => {
                                        const alreadyNominated = serviceSoyList.some(s => s.nomineeId === (cand.studentId || cand.employeeId))
                                        const failedLabel = (cand.failedCriteria || [])
                                            .map((g) => g.name.replace(/^Gate \d+:\s*/i, ''))
                                            .slice(0, 2)
                                            .join(', ')

                                        return (
                                            <tr
                                                key={cand.studentId || cand.employeeId}
                                                className={`hover:bg-slate-50/60 transition-colors ${cand.rank === 1 ? 'bg-amber-50/30' : ''}`}
                                            >
                                                <td className="py-3.5 px-4 font-bold align-top">
                                                    {cand.rank === 1 ? (
                                                        <span className="size-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-extrabold text-xs shadow-xs">
                                                            🏆 1
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-500 ml-2">#{cand.rank}</span>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-4 align-top">
                                                    <div className="font-bold text-slate-900 break-words">{cand.studentName || cand.employeeName}</div>
                                                    <div className="text-[11px] text-slate-400 font-mono break-all">{cand.studentId || cand.employeeId}</div>
                                                </td>

                                                <td className="py-3.5 px-4 font-semibold text-slate-800 align-top break-words">
                                                    {cand.classSection || cand.department}
                                                </td>

                                                <td className="py-3.5 px-4 text-center align-top">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 font-bold text-xs whitespace-nowrap">
                                                        <Star size={12} className="fill-blue-600 text-blue-600 shrink-0" />
                                                        <span>{cand.somCount}x Wins</span>
                                                    </span>
                                                </td>

                                                <td className="py-3.5 px-4 text-center font-semibold text-slate-800 align-top whitespace-nowrap">
                                                    {cand.avgScore ?? cand.avgKpi ?? '—'}%
                                                </td>

                                                <td className="py-3.5 px-4 text-center text-emerald-700 font-semibold align-top whitespace-nowrap">
                                                    {Number.isFinite(Number(cand.attendance)) ? `${cand.attendance}%` : '—'}
                                                </td>

                                                <td className="py-3.5 px-4 text-center font-extrabold text-slate-900 align-top whitespace-nowrap">
                                                    {cand.cumulativeScore} / 100
                                                </td>

                                                <td className="py-3.5 px-4 text-center align-top">
                                                    {cand.isEligible ? (
                                                        <span className="inline-flex max-w-full px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200 whitespace-normal text-left leading-snug">
                                                            ✓ Eligible (all 4 gates)
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className="inline-flex max-w-full px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-medium text-[10px] border border-rose-200 whitespace-normal text-left leading-snug"
                                                            title={cand.eligibilityReason || 'Ineligible'}
                                                        >
                                                            Ineligible{failedLabel ? `: ${failedLabel}` : ''}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-4 text-right align-top">
                                                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedCandForAudit(cand)
                                                                setSoyAuditModalOpen(true)
                                                            }}
                                                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                                                        >
                                                            <ShieldCheck size={13} className="text-indigo-600" />
                                                            <span>Audit Gates</span>
                                                        </button>
                                                        {cand.isEligible && !alreadyNominated && isSupervisor && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleNominateForSoy(cand)}
                                                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                                                            >
                                                                Nominate for Annual Trophy
                                                            </button>
                                                        )}
                                                        {alreadyNominated && (
                                                            <span className="text-xs font-semibold text-indigo-700 whitespace-nowrap">
                                                                In Governance Queue →
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 2: Committee Evaluation & MD Sign-off Governance Pipeline */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <ShieldCheck size={18} className="text-indigo-600" />
                                Star of the Year Governance Pipeline (Committee Scoring & MD Sign-Off)
                            </h3>
                            <span className="text-xs text-slate-400">
                                {serviceSoyList.length} Nominations in Registry
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="py-3 px-4">Nominee Name & ID</th>
                                        <th className="py-3 px-4">Academic Year</th>
                                        <th className="py-3 px-4 text-center">SOM Wins</th>
                                        <th className="py-3 px-4 text-center">Committee Score</th>
                                        <th className="py-3 px-4 text-center">Status</th>
                                        <th className="py-3 px-4">MD Remarks / Citation</th>
                                        <th className="py-3 px-4 text-right">Sign-off Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {serviceSoyList.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                                No candidates currently in the SOY governance pipeline.
                                            </td>
                                        </tr>
                                    ) : (
                                        serviceSoyList.map((soy) => {
                                            const isSelected = soy.status === 'Approved & Selected'
                                            const isPendingMd = soy.status === 'Pending MD Final Sign-Off'
                                            const isCommitteeReview = soy.status === 'Nominated for Committee Review'

                                            return (
                                                <tr key={soy.id} className="hover:bg-slate-50/60">
                                                    <td className="py-3.5 px-4">
                                                        <span className="font-bold text-slate-900 block">{soy.nomineeName}</span>
                                                        <span className="text-[11px] text-slate-400 font-mono">{soy.nomineeId}</span>
                                                    </td>
                                                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                                                        {soy.academicYear}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center font-bold text-indigo-700">
                                                        {soy.eligibilityVerification?.somWinsCount || 2}x Wins
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                                                        {soy.committeeEvaluation?.score ? `${soy.committeeEvaluation.score} / 100` : 'Pending'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                                            isSelected ? 'bg-amber-100 text-amber-800' :
                                                            isPendingMd ? 'bg-purple-100 text-purple-800' :
                                                            'bg-blue-100 text-blue-800'
                                                        }`}>
                                                            {soy.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 max-w-xs text-xs text-slate-600 truncate" title={soy.citation || soy.managingDirectorApproval?.mdRemarks}>
                                                        {soy.citation || soy.managingDirectorApproval?.mdRemarks || 'Awaiting sign-off'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {isCommitteeReview && isSupervisor && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenSoyScoring(soy)}
                                                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <Edit3 size={13} />
                                                                    Evaluate Score
                                                                </button>
                                                            )}
                                                            {isPendingMd && isDirectorOrAdmin && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedSoyForMd(soy)
                                                                        setMdSignOffModalOpen(true)
                                                                    }}
                                                                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <ShieldCheck size={13} />
                                                                    MD Final Sign-Off
                                                                </button>
                                                            )}
                                                            {isSelected && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handlePrintCitation(soy)}
                                                                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <Printer size={13} />
                                                                    Print Citation
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Review & Endorse SOM */}
            {reviewModalOpen && selectedSomForReview ? (
                <RecognitionModalOverlay
                    open
                    onClose={() => setReviewModalOpen(false)}
                    panelClassName="max-w-md"
                    labelledBy="som-review-modal-title"
                >
                    <div className="p-6 space-y-4 overflow-y-auto min-h-0">
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                            <h3 id="som-review-modal-title" className="text-base font-bold text-slate-900 flex items-start gap-2 min-w-0 leading-snug">
                                <Award size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                                <span className="break-words">Review & Endorse Nomination</span>
                            </h3>
                            <button type="button" onClick={() => setReviewModalOpen(false)} className="text-slate-400 shrink-0" aria-label="Close review popup">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="text-xs text-slate-600 space-y-1">
                            <span className="font-bold text-slate-900 block text-sm">{selectedSomForReview.studentName || selectedSomForReview.employeeName}</span>
                            <span>Nominated for: {selectedSomForReview.month} • Score: {selectedSomForReview.score || selectedSomForReview.kpiScore}%</span>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Coordinator Review Remarks *</label>
                            <textarea
                                rows={3}
                                value={reviewRemarks}
                                onChange={(e) => setReviewRemarks(e.target.value)}
                                className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <button type="button" onClick={() => setReviewModalOpen(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-600">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSomReview}
                                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                            >
                                Confirm Endorsement
                            </button>
                        </div>
                    </div>
                </RecognitionModalOverlay>
            ) : null}

            {/* MODAL: SOY 4-Tier Candidate Audit & Evaluation (portaled above AppShell) */}
            {soyAuditModalOpen && selectedCandForAudit ? (
                <RecognitionModalOverlay
                    open={soyAuditModalOpen}
                    onClose={() => {
                        setSoyAuditModalOpen(false)
                        setSelectedCandForAudit(null)
                    }}
                    panelClassName="max-w-2xl"
                    labelledBy="soy-audit-gates-title"
                >
                    {(() => {
                        const gpaParsed = deriveCumulativeGpa10(selectedCandForAudit)
                        const auditEval = selectedCandForAudit.eligibilityGates?.length
                            ? {
                                gates: selectedCandForAudit.eligibilityGates,
                                isEligible: selectedCandForAudit.isEligible,
                            }
                            : evaluateMandatorySoyGates({
                                somWinsCount: selectedCandForAudit.somCount,
                                cumulativeGpa: gpaParsed.ok ? gpaParsed.value : null,
                                attendancePercentage: selectedCandForAudit.attendance,
                                infractions: selectedCandForAudit.infractions ?? 0,
                            })
                        const auditGates = auditEval.gates
                        const auditPassed = auditGates.every((g) => g.passed)
                        const scorePct = selectedCandForAudit.avgScore ?? selectedCandForAudit.avgKpi
                        const gpaDisplay = Number.isFinite(Number(selectedCandForAudit.cumulativeGpa))
                            ? selectedCandForAudit.cumulativeGpa
                            : (gpaParsed.ok ? gpaParsed.value : null)

                        return (
                            <>
                                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                                            <ShieldCheck size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 id="soy-audit-gates-title" className="text-base font-bold text-slate-900 leading-snug break-words">
                                                Candidate 4-Tier Eligibility Audit
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                Star of the Year annual governance gates verification
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSoyAuditModalOpen(false)
                                            setSelectedCandForAudit(null)
                                        }}
                                        className="text-slate-400 hover:text-slate-600 shrink-0 p-1"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                        <div>
                                            <span className="font-bold text-slate-900 text-sm block">
                                                {selectedCandForAudit.studentName || selectedCandForAudit.employeeName}
                                            </span>
                                            <span className="text-slate-500 font-mono">
                                                ID: {selectedCandForAudit.studentId || selectedCandForAudit.employeeId} · {selectedCandForAudit.classSection || selectedCandForAudit.department}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-slate-500 block">Academic Session</span>
                                            <span className="font-bold text-slate-800">{selectedAcademicYear}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Mandatory Governance Gates Audit:
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {auditGates.map((gate, idx) => (
                                                <div
                                                    key={gate.id}
                                                    className={`p-3 rounded-xl border text-xs ${
                                                        gate.passed
                                                            ? 'bg-emerald-50/70 border-emerald-200'
                                                            : 'bg-rose-50/70 border-rose-200'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1 gap-2">
                                                        <span className="font-bold text-slate-800">
                                                            Gate {idx + 1}: {gate.name}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                                            gate.passed
                                                                ? 'bg-emerald-200 text-emerald-900'
                                                                : 'bg-rose-200 text-rose-900'
                                                        }`}>
                                                            {gate.passed ? 'PASSED' : 'FAILED'}
                                                        </span>
                                                    </div>
                                                    <p className="text-slate-600">
                                                        Requirement: <b>{gate.requirement}</b>
                                                    </p>
                                                    <p className="font-semibold text-slate-900 mt-0.5">
                                                        Candidate Achieved: {gate.id === 'gpa' && gpaDisplay != null
                                                            ? `${gpaDisplay} GPA${Number.isFinite(Number(scorePct)) ? ` (${scorePct}%)` : ''}`
                                                            : gate.achieved}
                                                    </p>
                                                    {!gate.passed && gate.reason ? (
                                                        <p className="text-rose-700 mt-1 text-[11px]">{gate.reason}</p>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={`p-3.5 rounded-xl text-xs flex items-start gap-2 ${
                                        auditPassed
                                            ? 'bg-emerald-100/70 border border-emerald-300 text-emerald-950'
                                            : 'bg-rose-100/70 border border-rose-300 text-rose-950'
                                    }`}>
                                        {auditPassed ? (
                                            <>
                                                <CheckCircle2 size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                                                <span>Overall result: <b>PASSED</b>. Candidate successfully passed all 4 institutional governance gates. Authorized for Star of the Year committee evaluation.</span>
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle size={16} className="text-rose-700 shrink-0 mt-0.5" />
                                                <span>
                                                    Overall result: <b>FAILED</b>. Failed gate(s):{' '}
                                                    {auditGates.filter((g) => !g.passed).map((g) => g.name).join(', ')}.
                                                    {' '}Annual nomination remains restricted until mandatory requirements are met.
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 p-4 sm:p-5 border-t border-slate-100 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSoyAuditModalOpen(false)
                                            setSelectedCandForAudit(null)
                                        }}
                                        className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                                    >
                                        Close
                                    </button>
                                    {auditPassed && isSupervisor && (
                                        <button
                                            type="button"
                                            onClick={() => handleNominateForSoy(selectedCandForAudit)}
                                            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                                        >
                                            <Trophy size={14} />
                                            Submit Formal SOY Nomination
                                        </button>
                                    )}
                                </div>
                            </>
                        )
                    })()}
                </RecognitionModalOverlay>
            ) : null}

            {/* MODAL: SOY Dedicated Marks Entry & Calculation Form */}
            {soyScoreModalOpen && selectedSoyForScore && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[min(92vh,900px)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                                    <Trophy size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Star of the Year Committee Evaluation & Marks Entry
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Candidate: <strong className="text-slate-800">{selectedSoyForScore.nomineeName}</strong> ({selectedSoyForScore.nomineeId}) • Session: <strong className="text-slate-700">{selectedSoyForScore.academicYear}</strong>
                                    </p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setSoyScoreModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
                            {/* Eligibility Verification Card */}
                            <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 font-medium">
                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                <span>Candidate passed all 4 mandatory institutional governance gates (≥2 SOM Wins, GPA/KPI ≥85%, Attendance ≥95%, 0 Infractions).</span>
                            </div>

                            {/* Dynamic Category-Wise Marks Calculation Form */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                    Annual Rubric Evaluation & Category Marks Entry (Max 100 Marks):
                                </h4>

                                {/* Category 1 */}
                                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 block">1. Monthly SOM Performance Consistency</span>
                                            <span className="text-[11px] text-slate-500">Cumulative average of monthly scores and academic/operational KPI (Weight: 30%)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <input
                                                type="number"
                                                min="0"
                                                max="30"
                                                value={soyFormScores.monthlyConsistency}
                                                onChange={(e) => setSoyFormScores({ ...soyFormScores, monthlyConsistency: Math.min(30, Math.max(0, Number(e.target.value) || 0)) })}
                                                className="w-16 px-2 py-1 text-xs font-bold text-center border border-slate-300 rounded-lg bg-white"
                                            />
                                            <span className="text-xs font-semibold text-slate-500">/ 30 pts</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Category 2 */}
                                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 block">2. Annual Session Attendance & Regularity</span>
                                            <span className="text-[11px] text-slate-500">Punctual daily attendance, biometric logs, and zero unauthorized absences (Weight: 20%)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <input
                                                type="number"
                                                min="0"
                                                max="20"
                                                value={soyFormScores.annualAttendance}
                                                onChange={(e) => setSoyFormScores({ ...soyFormScores, annualAttendance: Math.min(20, Math.max(0, Number(e.target.value) || 0)) })}
                                                className="w-16 px-2 py-1 text-xs font-bold text-center border border-slate-300 rounded-lg bg-white"
                                            />
                                            <span className="text-xs font-semibold text-slate-500">/ 20 pts</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Category 3 */}
                                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 block">3. Institutional Milestones & Leadership</span>
                                            <span className="text-[11px] text-slate-500">Inter-school competitions, committee contributions, innovation & problem-solving (Weight: 25%)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <input
                                                type="number"
                                                min="0"
                                                max="25"
                                                value={soyFormScores.milestoneLeadership}
                                                onChange={(e) => setSoyFormScores({ ...soyFormScores, milestoneLeadership: Math.min(25, Math.max(0, Number(e.target.value) || 0)) })}
                                                className="w-16 px-2 py-1 text-xs font-bold text-center border border-slate-300 rounded-lg bg-white"
                                            />
                                            <span className="text-xs font-semibold text-slate-500">/ 25 pts</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Category 4 */}
                                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 block">4. Disciplinary & Ethics Record</span>
                                            <span className="text-[11px] text-slate-500">Institutional code of conduct compliance, peer respect, and 0 infractions (Weight: 10%)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <input
                                                type="number"
                                                min="0"
                                                max="10"
                                                value={soyFormScores.disciplinaryStanding}
                                                onChange={(e) => setSoyFormScores({ ...soyFormScores, disciplinaryStanding: Math.min(10, Math.max(0, Number(e.target.value) || 0)) })}
                                                className="w-16 px-2 py-1 text-xs font-bold text-center border border-slate-300 rounded-lg bg-white"
                                            />
                                            <span className="text-xs font-semibold text-slate-500">/ 10 pts</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Category 5 */}
                                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 block">5. Selection Committee Viva & Comprehensive Review</span>
                                            <span className="text-[11px] text-slate-500">Annual jury evaluation, peer standing, and character citation (Weight: 15%)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <input
                                                type="number"
                                                min="0"
                                                max="15"
                                                value={soyFormScores.committeeJuryScore}
                                                onChange={(e) => setSoyFormScores({ ...soyFormScores, committeeJuryScore: Math.min(15, Math.max(0, Number(e.target.value) || 0)) })}
                                                className="w-16 px-2 py-1 text-xs font-bold text-center border border-slate-300 rounded-lg bg-white"
                                            />
                                            <span className="text-xs font-semibold text-slate-500">/ 15 pts</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Real-Time Total Marks & Results Calculation Card */}
                            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900 block">
                                        Calculated Total Composite Marks:
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xl font-extrabold text-indigo-950">
                                            {totalSoyScore} / 100 Marks
                                        </span>
                                        <span className="text-xs font-semibold text-indigo-700">
                                            ({totalSoyScore}%)
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                                        totalSoyScore >= 90
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                            : totalSoyScore >= 80
                                            ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                            : 'bg-slate-100 text-slate-800'
                                    }`}>
                                        {totalSoyScore >= 90
                                            ? '🏆 Gold Distinction · Recommended for Annual Rolling Trophy'
                                            : totalSoyScore >= 80
                                            ? '🎖️ Silver Distinction · Recommended for Annual Merit Citation'
                                            : '📜 Commended for Service'}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Panel Recommendation Remarks *</label>
                                <textarea
                                    rows={2}
                                    value={committeeRemarks}
                                    onChange={(e) => setCommitteeRemarks(e.target.value)}
                                    placeholder="Enter committee remarks, citation rationale, and summary..."
                                    className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                            <button type="button" onClick={() => setSoyScoreModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl cursor-pointer">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSoyScore}
                                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                                <CheckCircle2 size={14} />
                                Submit Calculated Score ({totalSoyScore}/100) & Forward for MD Sign-Off
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: MD Final Sign-Off for SOY */}
            {mdSignOffModalOpen && selectedSoyForMd && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[min(92vh,900px)] overflow-y-auto p-6 space-y-4">
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                            <h3 className="text-base font-bold text-purple-900 flex items-start gap-2 min-w-0 leading-snug">
                                <Trophy size={20} className="text-amber-500 shrink-0 mt-0.5" />
                                <span className="break-words">Managing Director Executive Final Sign-Off</span>
                            </h3>
                            <button type="button" onClick={() => setMdSignOffModalOpen(false)} className="text-slate-400 shrink-0" aria-label="Close sign-off popup">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-xl text-xs space-y-1">
                            <span className="font-bold text-purple-950 block text-sm">{selectedSoyForMd.nomineeName}</span>
                            <span>Committee Score: <b>{selectedSoyForMd.committeeEvaluation?.score}/100</b></span>
                            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-1.5 my-1">
                                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                <span>4-Tier Eligibility Audit Cleared · Recommended by Selection Committee</span>
                            </div>
                            <p className="text-purple-800 italic mt-1">"{selectedSoyForMd.committeeEvaluation?.remarks}"</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">MD Executive Remarks</label>
                            <input
                                type="text"
                                value={mdRemarks}
                                onChange={(e) => setMdRemarks(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Official Institutional Trophy Citation Text *</label>
                            <textarea
                                rows={3}
                                value={officialCitation}
                                onChange={(e) => setOfficialCitation(e.target.value)}
                                className="w-full p-3 text-xs border border-slate-200 rounded-xl font-serif"
                            />
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => handleConfirmMdSignOff(false)}
                                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                            >
                                Decline Sanction
                            </button>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setMdSignOffModalOpen(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-600">
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleConfirmMdSignOff(true)}
                                    className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                    <Trophy size={14} />
                                    Sanction Trophy & Approve
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: Nominate SOM — portaled above AppShell sidebar (z-300) / header (z-200) */}
            <RecognitionModalOverlay
                open={isNominateModalOpen}
                onClose={() => setIsNominateModalOpen(false)}
                panelClassName="max-w-4xl"
                labelledBy="som-nominate-modal-title"
            >
                        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                                    <Award size={18} />
                                </div>
                                <div className="min-w-0">
                                    <h3 id="som-nominate-modal-title" className="text-base font-bold text-slate-900 leading-snug break-words">
                                        Nominate Star of the Month ({domain === 'academic' ? 'Academic Student' : 'Non-Academic Staff'})
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1 break-words">
                                        Recognition Month: <strong className="text-slate-700">{selectedMonth}</strong> • Academic Year: <strong className="text-slate-700">{selectedAcademicYear}</strong>
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsNominateModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                                aria-label="Close nomination popup"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-6">
                            {domain === 'academic' ? (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                                        Step 1: Select Classes & Expand to Choose Nominee
                                    </h4>
                                    <BulkClassSectionSelector
                                        userRole={userRole}
                                        userEmail={userEmail}
                                        selectedClassKeys={nominationClassKeys}
                                        onSelectionChange={setNominationClassKeys}
                                        onNominateStudent={(student, classKey) => {
                                            setSelectedCandidate({ ...student, classKey })
                                            setCitationText(student.citation || '')
                                        }}
                                        nominatedStudentId={selectedCandidate?.id}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                                        Step 1: Select Department & Employee
                                    </h4>
                                    <DepartmentEmployeeSelector
                                        userRole={userRole}
                                        selectedDeptIds={nominationDeptIds}
                                        onSelectionChange={setNominationDeptIds}
                                        onNominateEmployee={(emp, deptName) => {
                                            setSelectedCandidate({ ...emp, deptName })
                                            setCitationText(emp.citation || '')
                                        }}
                                        nominatedEmployeeId={selectedCandidate?.id}
                                    />
                                </div>
                            )}

                            {selectedCandidate && (
                                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 animate-in fade-in space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-start gap-2 min-w-0">
                                            <Sparkles size={14} className="text-blue-600 shrink-0 mt-0.5" />
                                            <span className="break-words">Step 2: 5-Criteria Rubric Evaluation & Award Citation</span>
                                        </h4>
                                        <span className="text-xs font-semibold text-blue-700 shrink-0 break-words">
                                            Candidate: {selectedCandidate.name} ({selectedCandidate.id})
                                        </span>
                                    </div>

                                    {/* 5-Criteria Interactive Rubric Evaluation Form */}
                                    <div className="bg-white rounded-xl p-4 border border-blue-200 space-y-3.5">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                            <div>
                                                <h5 className="text-xs font-bold text-slate-900">
                                                    Interactive 5-Criteria Evaluation Rubric ({domain === 'academic' ? 'Academic Department' : 'Non-Academic Department'}, 20 Marks Each = 100 Marks Max)
                                                </h5>
                                                <p className="text-[11px] text-slate-500 mt-0.5">
                                                    {domain === 'academic'
                                                        ? 'Rate Scholastic Rigor, Attendance, Classroom Decorum, Peer Mentoring, and Values & Ethics.'
                                                        : 'Rate Shift Punctuality, Operational Diligence, Equipment Safety Upkeep, Turnaround Speed, and Teamwork.'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="text-right">
                                                    <span className="text-xs font-bold text-blue-700 block">
                                                        {totalRubricScore} / 100 Marks
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-semibold">
                                                        ({rubricPercentage}%)
                                                    </span>
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${rubricTier.color}`}>
                                                    {rubricTier.label}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-2.5">
                                            {(domain === 'academic'
                                                ? [
                                                    { key: 'scholasticExcellence', label: '1. Scholastic Performance & Homework Diligence', desc: 'Consistent academic performance, quality of assignment submissions, and intellectual curiosity (Max 20 Pts)' },
                                                    { key: 'punctuality', label: '2. Attendance & Punctuality Regularity', desc: 'On-time morning arrival, classroom presence regularity, and focused attentiveness (Max 20 Pts)' },
                                                    { key: 'classroomHygiene', label: '3. Classroom Decorum & Learning Space Care', desc: 'Desk orderliness, personal cleanliness, and learning space care (Max 20 Pts)' },
                                                    { key: 'peerMentoring', label: '4. Peer Collaboration & Mentoring Spirit', desc: 'Assisting peers, positive collaboration, and supportive conduct (Max 20 Pts)' },
                                                    { key: 'valuesAndEthics', label: '5. Institutional Values, Discipline & Integrity', desc: 'Honesty, institutional discipline, respectful conduct, and moral integrity (Max 20 Pts)' },
                                                ]
                                                : [
                                                    { key: 'punctualityReliability', label: '1. Punctuality, Shift Regularity & Attendance Reliability', desc: 'Shift adherence, prompt morning punch-in, and reliable attendance (Max 20 Pts)' },
                                                    { key: 'operationalDiligence', label: '2. Operational Diligence & Quality of Execution', desc: 'Meticulous task execution, safety checklists adherence, and thoroughness (Max 20 Pts)' },
                                                    { key: 'equipmentUpkeepSafety', label: '3. Equipment / Asset Upkeep & Safety Compliance', desc: 'Proper maintenance of tools, vehicles, equipment, and zero hazard creation (Max 20 Pts)' },
                                                    { key: 'turnaroundSpeed', label: '4. Turnaround Time & Task Execution Speed', desc: 'Swift resolution of work orders, issue tickets, and scheduled chores (Max 20 Pts)' },
                                                    { key: 'cooperationTeamwork', label: '5. Inter-Departmental Cooperation & Resource Conservation', desc: 'Positive team coordination, material waste reduction, and helpful attitude (Max 20 Pts)' },
                                                ]
                                            ).map((crit) => {
                                                const currentVal = (domain === 'academic' ? academicRubricScores[crit.key] : nonAcademicRubricScores[crit.key]) ?? 20
                                                const updateScore = (val) => {
                                                    const clamped = Math.min(20, Math.max(0, Number(val) || 0))
                                                    if (domain === 'academic') {
                                                        setAcademicRubricScores((prev) => ({ ...prev, [crit.key]: clamped }))
                                                    } else {
                                                        setNonAcademicRubricScores((prev) => ({ ...prev, [crit.key]: clamped }))
                                                    }
                                                }

                                                return (
                                                    <div key={crit.key} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors">
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                            <div>
                                                                <span className="text-xs font-bold text-slate-800 block">
                                                                    {crit.label}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500">
                                                                    {crit.desc}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {[10, 15, 18, 20].map((pts) => (
                                                                    <button
                                                                        key={pts}
                                                                        type="button"
                                                                        onClick={() => updateScore(pts)}
                                                                        className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                                                            currentVal === pts
                                                                                ? 'bg-blue-600 text-white shadow-xs scale-105'
                                                                                : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
                                                                        }`}
                                                                        title={`${pts} / 20 Marks`}
                                                                    >
                                                                        {pts}
                                                                    </button>
                                                                ))}
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="20"
                                                                    value={currentVal}
                                                                    onChange={(e) => updateScore(e.target.value)}
                                                                    className="w-14 px-2 py-1 text-xs font-bold text-center border border-slate-300 rounded-md bg-white ml-1"
                                                                />
                                                                <span className="text-xs font-bold text-slate-700 w-10 text-right">
                                                                    /20
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                Calculated Rubric Score (Total Marks & Percentage)
                                            </label>
                                            <div className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 flex items-center justify-between">
                                                <span>{totalRubricScore} / 100 Marks ({rubricPercentage}%)</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rubricTier.color}`}>
                                                    {rubricTier.label}
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                Award Recognition Month
                                            </label>
                                            <input
                                                type="text"
                                                value={selectedMonth}
                                                disabled
                                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-semibold"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Official Award Citation / Performance Rationale <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={citationText}
                                            onChange={(e) => setCitationText(e.target.value)}
                                            placeholder="Describe the candidate's achievements, conduct, and contributions warranting Star of the Month recognition..."
                                            className="w-full p-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                            <span className="text-xs text-slate-500 min-w-0 break-words">
                                {selectedCandidate
                                    ? `Ready to submit nomination for ${selectedCandidate.name}`
                                    : 'Please choose a nominee from the list above'}
                            </span>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsNominateModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={!selectedCandidate}
                                    onClick={handleSubmitNomination}
                                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                                >
                                    Submit Nomination for Review
                                </button>
                            </div>
                        </div>
            </RecognitionModalOverlay>
        </section>
    )
}

export default EnterpriseRecognitionPage
