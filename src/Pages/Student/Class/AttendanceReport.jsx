import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import { useActiveStudent } from '../../../context/ActiveStudentContext'
import { getStudentAttendanceSummary } from '../../../Common/AttendanceAndLeave/attendanceLeaveData'
import { IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listAttendance } from '../../../services/api/attendanceApiService'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const toIsoDate = (d) => {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
}

const matchesStudentRow = (row, activeStudent, activeStudentId) => {
    if (!row) return false
    const ids = [activeStudentId, activeStudent?.id, activeStudent?.admissionNumber, activeStudent?.admissionNo]
        .filter(Boolean).map(String)
    return [row.studentId, row.admissionNumber, row.id].filter(Boolean).map(String).some((v) => ids.includes(v))
}

const normalizeLiveStatus = (status) => {
    const raw = String(status || '').toLowerCase()
    if (raw.includes('absent')) return 'Absent'
    if (raw.includes('holiday')) return 'Holiday'
    if (raw.includes('late')) return 'Late Arrival'
    if (raw.includes('present')) return 'Present'
    return null // Unmarked / unknown → no evidence, row omitted
}

const AttendanceReport = () => {
    const { activeStudentId, activeStudent } = useActiveStudent()
    const live = isLiveApiEnabled()
    const [liveLogs, setLiveLogs] = useState([])
    const [liveLoading, setLiveLoading] = useState(Boolean(live))
    const [liveError, setLiveError] = useState('')
    const [selectMonth, setSelectMonth] = useState(new Date())
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [searchTerm, setSearchTerm] = useState('')
    const [entriesPerPage, setEntriesPerPage] = useState(10)
    const [currentPage, setCurrentPage] = useState(1)
    const [exportModal, setExportModal] = useState(false)

    const summary = useMemo(() => {
        if (live) return null
        return getStudentAttendanceSummary(activeStudentId || 'STU-2025-1001')
    }, [activeStudentId, live])

    // Live: only days the API actually returned a mark for — no fabricated month days.
    const loadLiveLogs = useCallback(async (monthDate) => {
        setLiveLoading(true)
        setLiveError('')
        const year = monthDate.getFullYear()
        const month = monthDate.getMonth()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const today = new Date()
        const className = activeStudent?.className || undefined
        const section = activeStudent?.section || undefined
        const dates = []
        for (let d = 1; d <= daysInMonth; d += 1) {
            const dt = new Date(year, month, d)
            if (dt > today) break
            dates.push(dt)
        }
        const results = await Promise.all(
            dates.map((dt) => listAttendance({ date: toIsoDate(dt), className, section }).then((res) => ({ dt, res }))),
        )
        const failed = results.find(({ res }) => !res.success)
        const rows = []
        results.forEach(({ dt, res }) => {
            if (!res.success || !Array.isArray(res.data)) return
            const mine = res.data.find((row) => matchesStudentRow(row, activeStudent, activeStudentId))
            const status = normalizeLiveStatus(mine?.attendanceStatus)
            if (!mine || !status) return
            rows.push({
                date: `${String(dt.getDate()).padStart(2, '0')} ${MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}`,
                status,
                day: DAY_NAMES[dt.getDay()],
                remarks: mine.inOutStatus || '—',
                timing: '—',
            })
        })
        rows.reverse()
        setLiveLoading(false)
        if (failed && rows.length === 0) {
            setLiveError(typeof failed.res.error === 'string' ? failed.res.error : 'Failed to load attendance.')
            setLiveLogs([])
            return
        }
        setLiveLogs(rows)
    }, [activeStudent, activeStudentId])

    useEffect(() => {
        if (!live) return
        loadLiveLogs(selectMonth || new Date())
    }, [live, loadLiveLogs, selectMonth])

    // Generate monthly logs dynamically for the selected month (mock only)
    const attendanceLogs = useMemo(() => {
        if (live) return liveLogs
        const year = selectMonth.getFullYear()
        const month = selectMonth.getMonth()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

        const list = []
        for (let d = daysInMonth; d >= 1; d--) {
            const dateObj = new Date(year, month, d)
            const dayOfWeek = dateObj.getDay()
            const dayName = dayNames[dayOfWeek]
            const formattedDate = `${String(d).padStart(2, '0')} ${monthNames[month]} ${year}`

            if (dayOfWeek === 0) {
                list.push({
                    date: formattedDate,
                    status: 'Holiday',
                    day: dayName,
                    remarks: 'Weekend Holiday',
                    timing: '—',
                })
            } else if (dayOfWeek === 6 && d % 2 === 0) {
                list.push({
                    date: formattedDate,
                    status: 'Holiday',
                    day: dayName,
                    remarks: 'Second / Fourth Saturday Institutional Holiday',
                    timing: '—',
                })
            } else if (d === 14 || d === 22) {
                list.push({
                    date: formattedDate,
                    status: 'Absent',
                    day: dayName,
                    remarks: d === 14 ? 'Medical Leave — Doctor Certificate Submitted' : 'Unnotified Leave',
                    timing: '—',
                })
            } else if (d === 7) {
                list.push({
                    date: formattedDate,
                    status: 'Late Arrival',
                    day: dayName,
                    remarks: 'Late Bus Transit Entry (09:12 AM)',
                    timing: '09:15 AM - 03:45 PM',
                })
            } else {
                list.push({
                    date: formattedDate,
                    status: 'Present',
                    day: dayName,
                    remarks: 'Regular Academic Day — Full Day Attended',
                    timing: '08:30 AM - 03:30 PM',
                })
            }
        }
        return list
    }, [live, liveLogs, selectMonth])

    const filteredLogs = useMemo(() => {
        return attendanceLogs.filter((item) => {
            if (statusFilter !== 'ALL' && item.status !== statusFilter) return false
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase()
                return (
                    item.date.toLowerCase().includes(q) ||
                    item.day.toLowerCase().includes(q) ||
                    item.remarks.toLowerCase().includes(q)
                )
            }
            return true
        })
    }, [attendanceLogs, statusFilter, searchTerm])

    const totalPages = Math.ceil(filteredLogs.length / entriesPerPage) || 1
    const paginatedLogs = useMemo(() => {
        const start = (currentPage - 1) * entriesPerPage
        return filteredLogs.slice(start, start + entriesPerPage)
    }, [filteredLogs, currentPage, entriesPerPage])

    const handleClearFilters = () => {
        setSelectMonth(new Date())
        setStatusFilter('ALL')
        setSearchTerm('')
        setCurrentPage(1)
    }

    const badgeStyle = {
        Present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        Absent: 'bg-red-50 text-red-700 border-red-200',
        'Late Arrival': 'bg-amber-50 text-amber-700 border-amber-200',
        Holiday: 'bg-slate-100 text-slate-700 border-slate-200',
    }

    return (
        <section className='space-y-6'>
            {live && liveError ? (
                <IntegrationNotice state='failed' title='Attendance report unavailable' description={liveError} />
            ) : null}
            {/* Filter Card */}
            <div className='bg-white rounded-2xl shadow-md p-5'>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end'>
                    <div className='flex flex-col gap-y-1.5'>
                        <label className='text-xs font-bold text-slate-600 uppercase'>Select Month</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={selectMonth}
                                onChange={(date) => {
                                    setSelectMonth(date || new Date())
                                    setCurrentPage(1)
                                }}
                                dateFormat='MMMM yyyy'
                                showMonthYearPicker
                                className='w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:border-[#515DEF]'
                            />
                            <Calendar
                                size={16}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none'
                            />
                        </div>
                    </div>

                    <div className='flex flex-col gap-y-1.5'>
                        <label className='text-xs font-bold text-slate-600 uppercase'>Status Filter</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value)
                                setCurrentPage(1)
                            }}
                            className='text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 w-full bg-white focus:outline-none focus:border-[#515DEF]'
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="Present">Present</option>
                            <option value="Absent">Absent</option>
                            <option value="Late Arrival">Late Arrival</option>
                            <option value="Holiday">Holiday</option>
                        </select>
                    </div>

                    <button
                        type='button'
                        onClick={() => setExportModal(true)}
                        className='bg-[#515DEF] text-white flex items-center gap-x-2 justify-center uppercase text-xs font-bold px-6 py-2.5 rounded-xl hover:opacity-90 transition-all cursor-pointer'
                    >
                        <Download className='w-4 h-4' />
                        Export Log
                    </button>

                    <button
                        type='button'
                        onClick={handleClearFilters}
                        className='bg-slate-100 text-slate-700 uppercase text-xs font-bold px-6 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-200 transition-all cursor-pointer'
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

            {/* Attendance Roster Table */}
            <div className='bg-white rounded-2xl shadow-md p-5 space-y-4'>
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                    <div>
                        <h2 className='text-lg font-bold text-slate-900'>
                            Daily Attendance Ledger — {selectMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                        </h2>
                        <p className='text-xs text-slate-500'>
                            Official biometric and roll-call records for student: <strong className='text-slate-800'>{activeStudent?.name || summary?.studentName || 'Student'}</strong>
                        </p>
                    </div>

                    <div className='flex items-center gap-2'>
                        <span className='text-xs text-slate-500'>Rows per page:</span>
                        <select
                            value={entriesPerPage}
                            onChange={(e) => {
                                setEntriesPerPage(Number(e.target.value))
                                setCurrentPage(1)
                            }}
                            className='px-2.5 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-700'
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={30}>30</option>
                        </select>
                    </div>
                </div>

                <div className="relative overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-[#EDEEF5] text-slate-700 uppercase text-[10px] font-bold">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3">Day</th>
                                <th className="px-4 py-3">Class Timing</th>
                                <th className="px-4 py-3">Attendance Remarks</th>
                            </tr>
                        </thead>

                        <tbody className='divide-y divide-slate-100 font-medium'>
                            {paginatedLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className='px-4 py-8 text-center text-slate-500'>
                                        {live && liveLoading
                                            ? 'Loading attendance…'
                                            : live
                                                ? 'No attendance has been recorded for this month.'
                                                : 'No attendance records match the selected filters.'}
                                    </td>
                                </tr>
                            ) : null}
                            {paginatedLogs.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-4 py-3.5 font-bold text-slate-900">{row.date}</td>
                                    <td className="px-4 py-3.5 text-center">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyle[row.status] || 'bg-slate-100 text-slate-700'}`}>
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-slate-600">{row.day}</td>
                                    <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">{row.timing}</td>
                                    <td className="px-4 py-3.5 text-slate-700">{row.remarks}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-500'>
                    <p>
                        Showing {filteredLogs.length === 0 ? 0 : (currentPage - 1) * entriesPerPage + 1} to {Math.min(currentPage * entriesPerPage, filteredLogs.length)} of {filteredLogs.length} days
                    </p>

                    <div className="flex items-center gap-1.5 self-center">
                        <button
                            type='button'
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => p - 1)}
                            className="size-7 flex items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className='px-2 font-bold text-slate-800'>
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            type='button'
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => p + 1)}
                            className="size-7 flex items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            <ExportModal exportModal={exportModal} setExportModal={setExportModal} />
        </section>
    )
}

export default AttendanceReport
