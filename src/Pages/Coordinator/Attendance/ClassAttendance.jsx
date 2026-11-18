import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar, Download, CheckCircle2, Save } from 'lucide-react'
import { toast } from 'react-toastify'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import { FeedbackState } from '../../../Common/ui'
import {
    ATTENDANCE_LIST,
    ATTENDANCE_STATUSES,
    CLASSES,
    SECTIONS,
    statusBadgeColor,
    inOutStatusBadgeColor,
} from './attendanceData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listAttendance, upsertAttendance } from '../../../services/api/attendanceApiService'

const CLASS_ATTENDANCE_STORAGE_KEY = 'schoolerp-class-attendance-records'

const toIsoDate = (value) => {
    if (!value) return ''
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
}

const ClassAttendance = () => {
    const live = isLiveApiEnabled()
    const [records, setRecords] = useState(() => {
        if (live) return []
        try {
            const stored = localStorage.getItem(CLASS_ATTENDANCE_STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored)
                if (Array.isArray(parsed) && parsed.length > 0) return parsed
            }
        } catch {
            /* ignore */
        }
        return ATTENDANCE_LIST
    })
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [exportModal, setExportModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [classFilter, setClassFilter] = useState(live ? 'Grade 3' : '')
    const [sectionFilter, setSectionFilter] = useState(live ? 'A' : '')
    const [statusFilter, setStatusFilter] = useState('')
    const [entriesPerPage, setEntriesPerPage] = useState(10)
    const [isManualMode, setIsManualMode] = useState(Boolean(live))
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [source, setSource] = useState(live ? 'backend' : 'local')

    const loadLive = useCallback(async () => {
        if (!classFilter.trim()) {
            setRecords([])
            setError('Select a class to load the live attendance roster.')
            setSource('error')
            setLoading(false)
            return
        }
        setLoading(true)
        setError('')
        const res = await listAttendance({
            date: toIsoDate(selectedDate) || toIsoDate(new Date()),
            className: classFilter.trim(),
            section: sectionFilter.trim() || undefined,
            roster: true,
        })
        setLoading(false)
        if (!res.success) {
            setSource('error')
            setError(typeof res.error === 'string' ? res.error : 'Failed to load attendance.')
            setRecords([])
            return
        }
        setRecords(Array.isArray(res.data) ? res.data : [])
        setSource('backend')
    }, [classFilter, sectionFilter, selectedDate])

    useEffect(() => {
        if (!isLiveApiEnabled()) return undefined
        loadLive()
        return undefined
    }, [loadLive])

    const handleSaveClassAttendance = async () => {
        if (live) {
            if (!classFilter.trim()) {
                toast.error('Class is required to save attendance.')
                return
            }
            const marks = records
                .filter((row) => row.studentId && row.attendanceStatus && row.attendanceStatus !== 'Unmarked')
                .map((row) => ({
                    studentId: row.studentId,
                    status: row.attendanceStatus,
                    inOutStatus: row.inOutStatus || undefined,
                }))
            if (!marks.length) {
                toast.error('Mark at least one student before saving.')
                return
            }
            setSaving(true)
            const res = await upsertAttendance({
                date: toIsoDate(selectedDate) || toIsoDate(new Date()),
                className: classFilter.trim(),
                section: sectionFilter.trim() || undefined,
                marks,
            })
            setSaving(false)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Server rejected attendance save.')
                return
            }
            toast.success('Class attendance saved on the server.')
            await loadLive()
            return
        }
        try {
            localStorage.setItem(CLASS_ATTENDANCE_STORAGE_KEY, JSON.stringify(records))
            window.dispatchEvent(new Event('schoolerp-student-attendance-sync'))
            toast.success('Class attendance records saved successfully!')
        } catch {
            toast.error('Failed to save attendance records.')
        }
    }

    const handleMarkAllPresent = () => {
        setRecords((prev) => prev.map((r) => {
            const matchesClass = !classFilter || r.className === classFilter || live
            const matchesSection = !sectionFilter || r.section === sectionFilter || live
            if (matchesClass && matchesSection) {
                return { ...r, attendanceStatus: 'Present', inOutStatus: r.inOutStatus || 'On Time' }
            }
            return r
        }))
    }

    const setStatus = (rowKey, status) => {
        setRecords((prev) => prev.map((row) => (
            (row.studentId || row.id) === rowKey
                ? { ...row, attendanceStatus: status }
                : row
        )))
    }

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase()
        return records.filter((row) => {
            if (!live && classFilter && row.className !== classFilter) return false
            if (!live && sectionFilter && row.section !== sectionFilter) return false
            if (statusFilter && row.attendanceStatus !== statusFilter) return false
            if (!q) return true
            const hay = `${row.studentId || ''} ${row.studentName || ''} ${row.admissionNumber || ''}`.toLowerCase()
            return hay.includes(q)
        })
    }, [records, searchTerm, classFilter, sectionFilter, statusFilter, live])

    const pageRows = filtered.slice(0, entriesPerPage)

    return (
        <section>
            {source === 'backend' ? (
                <p className='mb-3 text-xs font-medium text-[#027A48]'>
                    Live class attendance · GET/POST /api/v1/attendance (roster=true). Class name required.
                </p>
            ) : null}
            {source === 'error' ? (
                <FeedbackState kind='error' title='Attendance API unavailable' description={error} />
            ) : null}
            {loading ? (
                <FeedbackState kind='loading' title='Loading attendance' description='Fetching class roster marks…' />
            ) : null}

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                    <button
                        type='button'
                        onClick={() => {
                            setSearchTerm('')
                            if (!live) {
                                setClassFilter('')
                                setSectionFilter('')
                            }
                            setStatusFilter('')
                        }}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-1.5 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'
                    >
                        Clear Filters
                    </button>
                    <button
                        type='button'
                        onClick={() => setIsManualMode((v) => !v)}
                        className='text-sm font-semibold text-[#515DEF] border border-[#515DEF] rounded-lg px-4 py-1.5'
                    >
                        {isManualMode ? 'Manual mode on' : 'Enable manual mode'}
                    </button>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='search' className='text-base font-medium text-[#808080]'>Search</label>
                        <input
                            type='text'
                            id='search'
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder='Student ID, name...'
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='class-filter' className='text-base font-medium text-[#808080]'>Class</label>
                        {live ? (
                            <input
                                id='class-filter'
                                value={classFilter}
                                onChange={(e) => setClassFilter(e.target.value)}
                                placeholder='e.g. Grade 3'
                                className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                            />
                        ) : (
                            <select
                                id='class-filter'
                                value={classFilter}
                                onChange={(e) => setClassFilter(e.target.value)}
                                className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                            >
                                <option value=''>All</option>
                                {CLASSES.map((item) => (
                                    <option key={item} value={item}>Class {item}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='section-filter' className='text-base font-medium text-[#808080]'>Section</label>
                        {live ? (
                            <input
                                id='section-filter'
                                value={sectionFilter}
                                onChange={(e) => setSectionFilter(e.target.value)}
                                placeholder='e.g. A'
                                className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                            />
                        ) : (
                            <select
                                id='section-filter'
                                value={sectionFilter}
                                onChange={(e) => setSectionFilter(e.target.value)}
                                className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                            >
                                <option value=''>All</option>
                                {SECTIONS.map((item) => (
                                    <option key={item} value={item}>Section {item}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='status-filter' className='text-base font-medium text-[#808080]'>Attendance Status</label>
                        <select
                            id='status-filter'
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {ATTENDANCE_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>Date</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={selectedDate}
                                onChange={(date) => setSelectedDate(date)}
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                </div>
            </div>

            {!loading && source !== 'error' ? (
                <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                    <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                        <h2 className='text-xl font-medium text-black'>Attendance List</h2>
                        <div className='flex items-center gap-2'>
                            {isManualMode ? (
                                <>
                                    <button type='button' onClick={handleMarkAllPresent} className='flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg'>
                                        <CheckCircle2 size={14} /> Mark All Present
                                    </button>
                                    <button type='button' disabled={saving} onClick={handleSaveClassAttendance} className='flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-60'>
                                        <Save size={14} /> {saving ? 'Saving…' : 'Save Class Attendance'}
                                    </button>
                                </>
                            ) : null}
                            <button type='button' onClick={() => setExportModal(true)} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md flex items-center gap-x-2'>
                                <Download size={16} /> Export
                            </button>
                        </div>
                    </div>
                    <div className='flex gap-x-2 items-center my-2'>
                        <select value={entriesPerPage} onChange={(e) => setEntriesPerPage(Number(e.target.value))} className='px-2 py-1.5 bg-white text-[#515DEF] border border-[#515DEF] rounded-md'>
                            {[10, 20, 30, 40, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <span className='text-sm font-normal text-[#515DEF]'>Entries Per Page</span>
                    </div>
                    <div className='relative overflow-x-auto'>
                        <table className='w-full text-sm text-left'>
                            <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                                <tr>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Student ID</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Student Name</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Class</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Section</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Attendance Status</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>In &amp; out Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className='px-2 py-8 text-center text-[#667085]'>
                                            {live ? 'No roster rows for this class/date. Confirm class name matches campus masters.' : 'No attendance records found.'}
                                        </td>
                                    </tr>
                                ) : pageRows.map((row) => {
                                    const key = row.studentId || row.id
                                    return (
                                        <tr key={key} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7]'>
                                            <td className='px-2 py-3'>{row.studentId || row.id || '—'}</td>
                                            <td className='px-2 py-3 text-[#1E1E1E] font-medium'>{row.studentName || '—'}</td>
                                            <td className='px-2 py-3'>{row.className || '—'}</td>
                                            <td className='px-2 py-3'>{row.section || '—'}</td>
                                            <td className='px-2 py-3'>
                                                {isManualMode ? (
                                                    <select
                                                        value={row.attendanceStatus || 'Unmarked'}
                                                        onChange={(e) => setStatus(key, e.target.value)}
                                                        className='text-sm border border-[#D9D9D9] rounded-md px-2 py-1'
                                                    >
                                                        {['Unmarked', ...ATTENDANCE_STATUSES].filter((v, i, a) => a.indexOf(v) === i).map((status) => (
                                                            <option key={status} value={status}>{status}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeColor[row.attendanceStatus] || ''}`}>
                                                        {row.attendanceStatus || '—'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className='px-2 py-3'>
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${inOutStatusBadgeColor[row.inOutStatus] || ''}`}>
                                                    {row.inOutStatus || '—'}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

            <ExportModal exportModal={exportModal} setExportModal={setExportModal} recordCount={filtered.length} />
        </section>
    )
}

export default ClassAttendance
