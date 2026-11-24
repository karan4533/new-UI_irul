import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar, ChevronLeft, ChevronRight, Download, Moon, Sun } from 'lucide-react'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTransportStudentAttendance } from '../../../services/api/transportApiService'
import {
    MARKED_STATUSES,
    filterAttendanceHistory,
    markedStatusBadgeColor,
} from './attendanceHistoryData'
import { ATTENDANCE_PERIODS, ATTENDANCE_PHASES, SCHOOL_NAME } from './studentAttendanceData'

const thClass = 'px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'
const tdClass = 'px-2 py-4 text-[#667085]'

const flattenHistory = (rows) => {
    const out = []
    rows.forEach((row) => {
        ;['Morning', 'Evening'].forEach((period) => {
            const bucket = period.toLowerCase()
            ;['Pickup', 'Drop'].forEach((phaseLabel) => {
                const phaseKey = phaseLabel.toLowerCase()
                const status = row?.[bucket]?.[phaseKey]
                if (!status || status === 'Pending') return
                const location = phaseKey === 'drop' && period === 'Morning'
                    ? SCHOOL_NAME
                    : phaseKey === 'pickup' && period === 'Evening'
                        ? SCHOOL_NAME
                        : (row.busStop || '—')
                out.push({
                    id: `${row.id}-${bucket}-${phaseKey}`,
                    attendanceDate: row.attendanceDate || '',
                    studentId: row.studentId || '',
                    studentName: row.studentName || '',
                    classSection: row.classSection || '',
                    busStop: row.busStop || '',
                    period,
                    phase: phaseLabel,
                    location,
                    status,
                    markedAt: '—',
                })
            })
        })
    })
    return out
}

const AttendanceHistory = () => {
    const live = isLiveApiEnabled()
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')
    const [period, setPeriod] = useState('Morning')
    const [phase, setPhase] = useState('pickup')
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [timeframe, setTimeframe] = useState('')
    const [fromDate, setFromDate] = useState(null)
    const [toDate, setToDate] = useState(null)
    const [exportModal, setExportModal] = useState(false)

    const load = useCallback(async () => {
        if (!live) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        const res = await listTransportStudentAttendance()
        if (!res.success) {
            setHistory([])
            setError(res.error || 'Failed to load attendance history.')
            setLoading(false)
            return
        }
        setHistory(flattenHistory(res.data || []))
        setError('')
        setLoading(false)
    }, [live])

    useEffect(() => {
        load()
    }, [load])

    const phaseOptions = ATTENDANCE_PHASES[period]
    const activePhase = phaseOptions.find((item) => item.key === phase)

    const filteredRecords = useMemo(() => filterAttendanceHistory({
        records: history,
        search,
        period,
        phase: phase.charAt(0).toUpperCase() + phase.slice(1),
        status,
        fromDate,
        toDate,
    }), [history, search, period, phase, status, fromDate, toDate])

    const handlePeriodChange = (nextPeriod) => {
        setPeriod(nextPeriod)
        setPhase(ATTENDANCE_PHASES[nextPeriod][0].key)
    }

    const clearFilters = () => {
        setSearch('')
        setStatus('')
        setTimeframe('')
        setFromDate(null)
        setToDate(null)
    }

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Attendance history is derived from GET /api/v1/ops/transport-student-attendance.'
            />
        )
    }

    return (
        <section className='space-y-6'>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between md:items-center md:flex-row flex-col gap-y-4'>
                    <button
                        type='button'
                        onClick={clearFilters}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-2 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all cursor-pointer'
                    >
                        Clear Filters
                    </button>
                    <select
                        value={timeframe}
                        onChange={(event) => setTimeframe(event.target.value)}
                        className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full md:max-w-xs'
                    >
                        <option value=''>From Beginning</option>
                        <option value='week'>This Week</option>
                        <option value='month'>This Month</option>
                    </select>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='history-search' className='text-base font-medium text-[#808080]'>Search</label>
                        <input
                            id='history-search'
                            type='text'
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder='Student ID, name…'
                            className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>Status</label>
                        <select
                            value={status}
                            onChange={(event) => setStatus(event.target.value)}
                            className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {MARKED_STATUSES.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>From</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={fromDate}
                                onChange={(date) => setFromDate(date)}
                                isClearable
                                dateFormat='dd-MM-yyyy'
                                placeholderText='01-01-2024'
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>To</label>
                        <div className='relative'>
                            <DatePicker
                                selected={toDate}
                                onChange={(date) => setToDate(date)}
                                isClearable
                                dateFormat='dd-MM-yyyy'
                                placeholderText='01-01-2024'
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                </div>

                <div className='mt-5 flex flex-wrap gap-2'>
                    {ATTENDANCE_PERIODS.map((item) => (
                        <button
                            key={item}
                            type='button'
                            onClick={() => handlePeriodChange(item)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${
                                period === item ? 'bg-[#515DEF] text-white' : 'bg-[#EEF0FF] text-[#515DEF]'
                            }`}
                        >
                            {item === 'Morning' ? <Sun size={14} /> : <Moon size={14} />}
                            {item}
                        </button>
                    ))}
                    {phaseOptions.map((item) => (
                        <button
                            key={item.key}
                            type='button'
                            onClick={() => setPhase(item.key)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                                phase === item.key ? 'bg-[#2E3192] text-white' : 'border border-[#D9D9D9] text-[#667085]'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4'>
                    <h2 className='text-xl font-semibold text-black'>
                        {period}
                        {' '}
                        {activePhase?.label}
                        {' '}
                        History
                    </h2>
                    <div className='flex gap-2'>
                        <button type='button' onClick={load} className='text-sm border border-[#515DEF] text-[#515DEF] px-4 py-2 rounded-md'>Refresh</button>
                        <button
                            type='button'
                            onClick={() => setExportModal(true)}
                            className='inline-flex items-center gap-2 bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md uppercase'
                        >
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                </div>

                {loading ? (
                    <p className='text-sm text-slate-500 py-8 text-center'>Loading live history…</p>
                ) : error ? (
                    <FeedbackState kind='error' title='Could not load history' description={error} />
                ) : (
                    <>
                        <div className='relative overflow-x-auto'>
                            <table className='w-full text-sm text-left min-w-[1000px]'>
                                <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap'>
                                    <tr>
                                        <th className={`${thClass} rounded-s-lg`}>Date</th>
                                        <th className={thClass}>Student</th>
                                        <th className={thClass}>Class</th>
                                        <th className={thClass}>Location</th>
                                        <th className={thClass}>Period / Phase</th>
                                        <th className={`${thClass} rounded-e-lg`}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className='px-2 py-8 text-center text-[#667085]'>
                                                No marked attendance yet. Marks from Student Attendance appear here after save.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRecords.map((record) => (
                                            <tr key={record.id} className='border-b border-[#f2f4f7]'>
                                                <td className={`${tdClass} rounded-s-lg`}>{record.attendanceDate || '—'}</td>
                                                <td className={`${tdClass} font-medium text-[#1E1E1E]`}>
                                                    {record.studentName}
                                                    <span className='block text-xs text-[#808080]'>{record.studentId}</span>
                                                </td>
                                                <td className={tdClass}>{record.classSection || '—'}</td>
                                                <td className={tdClass}>{record.location || '—'}</td>
                                                <td className={tdClass}>
                                                    {record.period}
                                                    {' / '}
                                                    {record.phase}
                                                </td>
                                                <td className={`${tdClass} rounded-e-lg`}>
                                                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${markedStatusBadgeColor[record.status] || ''}`}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-2'>
                            <p className='text-sm font-medium text-[#515DEF]'>
                                Showing 1 to {filteredRecords.length} of {filteredRecords.length} entries
                            </p>
                            <div className='flex items-center gap-2'>
                                <button type='button' className='size-8 flex items-center justify-center rounded-full border border-[#E2E8F0] text-[#515DEF]'>
                                    <ChevronLeft size={16} />
                                </button>
                                <button type='button' className='size-8 flex items-center justify-center rounded-full bg-[#515DEF] text-white text-sm font-medium'>1</button>
                                <button type='button' className='size-8 flex items-center justify-center rounded-full border border-[#E2E8F0] text-[#515DEF]'>
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <ExportModal exportModal={exportModal} setExportModal={setExportModal} />
        </section>
    )
}

export default AttendanceHistory
