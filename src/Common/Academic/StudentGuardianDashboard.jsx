import React, { useEffect, useMemo, useState } from 'react'
import {
    ArrowRight,
    Award,
    Calendar,
    CalendarDays,
    CreditCard,
    FileText,
    GraduationCap,
    Shield,
    UsersRound,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useActiveStudent } from '../../context/ActiveStudentContext'
import { formatGradeSection } from '../../Pages/Student/studentPortalConfig'
import { EnterpriseKpiCard, StatusBadge } from '../ui'
import { getStudentGuardianDashboardData } from './studentGuardianDashboardData'
import { getStudentAttendanceCalendar } from '../../services/api/attendanceApiService.js'
import { getMyFees } from '../../services/api/financeApiService.js'
import { getStudentResults } from '../../services/api/examsApiService.js'

function computeAttendanceKpi(calendarMap) {
    const codes = Object.values(calendarMap || {})
    const counted = codes.filter((code) => code === 'P' || code === 'A' || code === 'H')
    const present = codes.filter((code) => code === 'P').length
    const absent = codes.filter((code) => code === 'A').length
    if (counted.length === 0) {
        return {
            value: '—',
            change: 'No records',
            isPositive: true,
            context: 'No attendance marked yet for this month',
            empty: true,
        }
    }
    const pct = Math.round((present / Math.max(present + absent, 1)) * 1000) / 10
    return {
        value: `${pct}%`,
        change: `${present} present · ${absent} absent`,
        isPositive: pct >= 75,
        context: `From class attendance (${counted.length} day${counted.length === 1 ? '' : 's'} this month)`,
        empty: false,
    }
}

function computeFeeKpi(feeData, studentId) {
    const installments = Array.isArray(feeData?.installments) ? feeData.installments : []
    const forStudent = installments.filter((row) => String(row.studentId) === String(studentId))
    if (forStudent.length === 0) {
        return {
            value: '—',
            change: 'No fee records',
            isPositive: true,
            context: 'No fee installments available for this student yet',
            empty: true,
            balanceLabel: 'No fee balance yet →',
        }
    }
    const balance = forStudent.reduce((sum, row) => sum + Number(row.balanceAmount || 0), 0)
    const paid = forStudent.reduce((sum, row) => sum + Number(row.paidAmount || 0), 0)
    const cleared = balance <= 0
    return {
        value: `₹${Math.round(balance)}`,
        change: cleared ? 'All Cleared' : 'Balance due',
        isPositive: cleared,
        context: cleared
            ? `Paid ₹${Math.round(paid)} across ${forStudent.length} installment${forStudent.length === 1 ? '' : 's'}`
            : `${forStudent.length} installment${forStudent.length === 1 ? '' : 's'} on record`,
        empty: false,
        balanceLabel: cleared ? '₹0 Balance (Cleared) →' : `₹${Math.round(balance)} due →`,
    }
}

const StudentGuardianDashboard = () => {
    const { activeStudent, isParentPortal, routePrefix } = useActiveStudent()
    const dashboard = getStudentGuardianDashboardData(routePrefix)
    const [attendanceKpi, setAttendanceKpi] = useState({
        value: '—',
        change: 'Loading…',
        isPositive: true,
        context: 'Loading attendance…',
        empty: true,
    })
    const [feeKpi, setFeeKpi] = useState({
        value: '—',
        change: 'Loading…',
        isPositive: true,
        context: 'Loading fees…',
        empty: true,
        balanceLabel: 'Loading…',
    })
    const [resultSummary, setResultSummary] = useState({
        examAppeared: 0,
        averagePercent: 0,
        highestSubject: '—',
        overallGrade: '—',
        hasData: false,
    })

    useEffect(() => {
        let cancelled = false
        async function loadLiveKpis() {
            if (!activeStudent?.id) return
            const now = new Date()
            const [attendanceRes, feesRes, resultsRes] = await Promise.all([
                getStudentAttendanceCalendar(activeStudent.id, {
                    year: now.getFullYear(),
                    month: now.getMonth() + 1,
                }),
                getMyFees(),
                getStudentResults(activeStudent.id),
            ])
            if (cancelled) return

            if (attendanceRes.success) {
                setAttendanceKpi(computeAttendanceKpi(attendanceRes.data || {}))
            } else {
                setAttendanceKpi({
                    value: '—',
                    change: 'Unavailable',
                    isPositive: true,
                    context: attendanceRes.error || 'Unable to load attendance',
                    empty: true,
                })
            }

            if (feesRes.success) {
                setFeeKpi(computeFeeKpi(feesRes.data || {}, activeStudent.id))
            } else {
                setFeeKpi({
                    value: '—',
                    change: 'Unavailable',
                    isPositive: true,
                    context: feesRes.error || 'Unable to load fees',
                    empty: true,
                    balanceLabel: 'Fees unavailable →',
                })
            }

            if (resultsRes.success && resultsRes.data?.summary) {
                setResultSummary(resultsRes.data.summary)
            } else {
                setResultSummary({
                    examAppeared: 0,
                    averagePercent: 0,
                    highestSubject: '—',
                    overallGrade: '—',
                    hasData: false,
                })
            }
        }
        loadLiveKpis()
        return () => {
            cancelled = true
        }
    }, [activeStudent?.id])

    const publishedStats = useMemo(
        () => [
            ['Exams Appeared', resultSummary.hasData ? resultSummary.examAppeared : '—'],
            [
                'Average Score',
                resultSummary.hasData ? `${resultSummary.averagePercent}%` : '—',
            ],
            ['Highest Subject', resultSummary.hasData ? resultSummary.highestSubject : '—'],
            ['Overall Standing', resultSummary.hasData ? resultSummary.overallGrade : '—'],
        ],
        [resultSummary],
    )

    if (!dashboard) return null

    return (
        <section className='space-y-6 pb-6 font-inter'>
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                <div>
                    <div className='flex items-center gap-2'>
                        <h1 className='text-2xl font-bold tracking-tight text-slate-900'>
                            {isParentPortal
                                ? `${activeStudent.name} · Family Portal`
                                : `Welcome, ${activeStudent.name}`}
                        </h1>
                        <span className='rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100'>
                            {isParentPortal ? 'Guardian Overview' : 'Student Workspace'}
                        </span>
                    </div>
                    <p className='mt-1 text-xs text-slate-500'>
                        {formatGradeSection(activeStudent)} · Roll #{activeStudent.rollNumber} · Student ID:{' '}
                        {activeStudent.id}
                    </p>
                </div>

                <div className='flex items-center gap-2'>
                    <NavLink
                        to={`${routePrefix}/profile`}
                        className='inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs'
                    >
                        <UsersRound size={14} className='text-blue-600' /> Student Profile
                    </NavLink>
                    {isParentPortal && (
                        <NavLink
                            to='/parent/select-child'
                            className='inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs'
                        >
                            Switch Child
                        </NavLink>
                    )}
                </div>
            </div>

            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                <EnterpriseKpiCard
                    title='Attendance Percentage'
                    value={attendanceKpi.value}
                    change={attendanceKpi.change}
                    isPositive={attendanceKpi.isPositive}
                    context={attendanceKpi.context}
                    to={`${routePrefix}/attendance`}
                />
                <EnterpriseKpiCard
                    title='Overall Academic Grade'
                    value={resultSummary.hasData ? resultSummary.overallGrade : '—'}
                    change={resultSummary.hasData ? 'Published' : 'No results yet'}
                    isPositive={true}
                    context={
                        resultSummary.hasData
                            ? `Average: ${resultSummary.averagePercent}% across published subjects`
                            : 'No published exam results yet'
                    }
                    to={`${routePrefix}/student-evaluation/exam-result`}
                />
                <EnterpriseKpiCard
                    title='Due Assignments & Tasks'
                    value='—'
                    change='Not connected'
                    isPositive={true}
                    context='Assignment feed is not wired to a live API yet'
                    to={`${routePrefix}/assessment-list/assignment`}
                />
                <EnterpriseKpiCard
                    title='Tuition & Transport Fee'
                    value={feeKpi.value}
                    change={feeKpi.change}
                    isPositive={feeKpi.isPositive}
                    context={feeKpi.context}
                    to={`${routePrefix}/fees`}
                />
            </div>

            <div className='rounded-[1.25rem] border border-blue-200/80 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white p-5 shadow-xs'>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-blue-100 pb-3 mb-4'>
                    <div className='flex items-center gap-2.5'>
                        <div className='p-2 rounded-xl bg-blue-600 text-white'>
                            <Shield size={18} />
                        </div>
                        <div>
                            <h3 className='text-sm font-bold text-slate-900'>
                                Guardian & Parent Portal Bridge
                            </h3>
                            <p className='text-xs text-slate-500'>
                                Live attendance, fees and published results for the selected child.
                            </p>
                        </div>
                    </div>
                    <NavLink
                        to={`${routePrefix}/profile`}
                        className='inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800'
                    >
                        View Full Student Profile <ArrowRight size={13} />
                    </NavLink>
                </div>

                <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                    <NavLink
                        to={`${routePrefix}/student-evaluation/exam-result`}
                        className='flex flex-col rounded-xl border border-slate-200/80 bg-white p-3 hover:border-blue-400 hover:shadow-xs transition-all'
                    >
                        <span className='text-[10px] font-bold uppercase text-slate-400'>Academic Progress</span>
                        <span className='mt-1 text-sm font-bold text-slate-900 flex items-center justify-between'>
                            <span>Term Results</span>
                            <Award size={15} className='text-amber-500' />
                        </span>
                        <span className='mt-1 text-[11px] text-blue-600 font-semibold'>View Exam Marks →</span>
                    </NavLink>

                    <NavLink
                        to={`${routePrefix}/student-evaluation/report-cards`}
                        className='flex flex-col rounded-xl border border-slate-200/80 bg-white p-3 hover:border-blue-400 hover:shadow-xs transition-all'
                    >
                        <span className='text-[10px] font-bold uppercase text-slate-400'>Progress Report</span>
                        <span className='mt-1 text-sm font-bold text-slate-900 flex items-center justify-between'>
                            <span>CBSE Card</span>
                            <FileText size={15} className='text-blue-500' />
                        </span>
                        <span className='mt-1 text-[11px] text-blue-600 font-semibold'>Download PDF →</span>
                    </NavLink>

                    <NavLink
                        to={`${routePrefix}/payment/fees-payment`}
                        className='flex flex-col rounded-xl border border-slate-200/80 bg-white p-3 hover:border-blue-400 hover:shadow-xs transition-all'
                    >
                        <span className='text-[10px] font-bold uppercase text-slate-400'>Tuition & Transport</span>
                        <span className='mt-1 text-sm font-bold text-slate-900 flex items-center justify-between'>
                            <span>Fee Receipts</span>
                            <CreditCard size={15} className='text-emerald-500' />
                        </span>
                        <span className='mt-1 text-[11px] text-emerald-600 font-semibold'>
                            {feeKpi.balanceLabel}
                        </span>
                    </NavLink>

                    <NavLink
                        to={`${routePrefix}/class/attendance-report`}
                        className='flex flex-col rounded-xl border border-slate-200/80 bg-white p-3 hover:border-blue-400 hover:shadow-xs transition-all'
                    >
                        <span className='text-[10px] font-bold uppercase text-slate-400'>Punch Logs</span>
                        <span className='mt-1 text-sm font-bold text-slate-900 flex items-center justify-between'>
                            <span>Attendance</span>
                            <Calendar size={15} className='text-purple-500' />
                        </span>
                        <span className='mt-1 text-[11px] text-purple-600 font-semibold'>
                            {attendanceKpi.empty ? 'No records yet →' : `${attendanceKpi.value} this month →`}
                        </span>
                    </NavLink>
                </div>
            </div>

            <div className='grid gap-6 lg:grid-cols-3'>
                <div className='lg:col-span-2 rounded-[1.25rem] border border-slate-200/80 bg-white p-5 shadow-xs'>
                    <div className='flex items-center justify-between border-b border-slate-100 pb-3 mb-3'>
                        <div className='flex items-center gap-2'>
                            <CalendarDays size={16} className='text-blue-600' />
                            <h3 className='text-sm font-semibold text-slate-900'>Today&apos;s Class Schedule</h3>
                        </div>
                        <NavLink
                            to={`${routePrefix}/class/timetable-list`}
                            className='text-xs font-semibold text-blue-600 hover:underline'
                        >
                            Full Timetable
                        </NavLink>
                    </div>

                    <div className='space-y-2'>
                        {(dashboard.today || []).length === 0 ? (
                            <p className='text-xs text-slate-500 py-4 text-center'>
                                No timetable entries available for today.
                            </p>
                        ) : (
                            dashboard.today.map((item) => (
                                <NavLink
                                    key={`${item.time}-${item.title}`}
                                    to={item.to}
                                    className='flex items-center justify-between rounded-xl p-3 hover:bg-slate-50 transition-colors text-xs border border-slate-100'
                                >
                                    <div className='flex items-center gap-3 min-w-0'>
                                        <span className='font-bold text-blue-600 w-16 shrink-0'>{item.time}</span>
                                        <div className='min-w-0'>
                                            <p className='font-semibold text-slate-800 truncate'>{item.title}</p>
                                            <p className='text-slate-400 mt-0.5 truncate'>{item.description}</p>
                                        </div>
                                    </div>
                                    <div className='flex items-center gap-2 shrink-0'>
                                        <StatusBadge status={item.status} />
                                        <ArrowRight size={14} className='text-slate-400' />
                                    </div>
                                </NavLink>
                            ))
                        )}
                    </div>
                </div>

                <div className='lg:col-span-1 rounded-[1.25rem] border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between'>
                    <div>
                        <div className='flex items-center justify-between border-b border-slate-100 pb-3 mb-4'>
                            <div className='flex items-center gap-2'>
                                <GraduationCap size={16} className='text-blue-600' />
                                <h3 className='text-sm font-semibold text-slate-900'>Published Results</h3>
                            </div>
                        </div>

                        <div className='grid grid-cols-2 gap-3 mb-4'>
                            {publishedStats.map(([label, value]) => (
                                <div key={label} className='rounded-xl bg-slate-50 p-3'>
                                    <p className='text-[10px] font-semibold text-slate-400 uppercase tracking-wider'>
                                        {label}
                                    </p>
                                    <p className='mt-1 text-base font-bold text-slate-800'>{value}</p>
                                </div>
                            ))}
                        </div>
                        {!resultSummary.hasData ? (
                            <p className='text-xs text-slate-500 mb-3'>
                                No published exam results yet for this student.
                            </p>
                        ) : null}
                    </div>

                    <NavLink
                        to={`${routePrefix}/student-evaluation/exam-result`}
                        className='inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-50 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors'
                    >
                        View Comprehensive Report Card <ArrowRight size={14} />
                    </NavLink>
                </div>
            </div>

            <nav aria-label='Student portal shortcuts' className='grid gap-4 sm:grid-cols-3'>
                {[
                    {
                        label: 'School Announcements',
                        to: `${routePrefix}/announcement`,
                        desc: 'Circulars & official notices',
                    },
                    {
                        label: 'Academic Calendar',
                        to: `${routePrefix}/academic-calendar`,
                        desc: 'Term dates, exams & holidays',
                    },
                    {
                        label: 'Teacher Communication',
                        to: `${routePrefix}/communication/inbox`,
                        desc: 'Direct messages & circulars',
                    },
                ].map((item) => (
                    <NavLink
                        key={item.label}
                        to={item.to}
                        className='flex items-center justify-between rounded-[1.25rem] border border-slate-200/80 bg-white p-4 text-xs font-semibold text-slate-800 hover:border-blue-400 hover:shadow-xs transition-all'
                    >
                        <div>
                            <p className='text-slate-900 font-bold'>{item.label}</p>
                            <p className='text-slate-400 font-normal mt-0.5'>{item.desc}</p>
                        </div>
                        <ArrowRight size={16} className='text-blue-600 shrink-0 ml-3' />
                    </NavLink>
                ))}
            </nav>
        </section>
    )
}

export default StudentGuardianDashboard
