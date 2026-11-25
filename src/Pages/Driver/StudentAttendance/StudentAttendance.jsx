import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import {
    Bus,
    Calendar,
    CheckCircle2,
    MapPin,
    Moon,
    Search,
    Sun,
    UserX,
    XCircle,
} from 'lucide-react'
import { toast } from 'react-toastify'
import noProfile from '../../../assets/images/no-profile.png'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    listTransportRoutes,
    listTransportStudentAssignments,
    listTransportStudentAttendance,
    listTransportVehicles,
    upsertTransportStudentAttendance,
} from '../../../services/api/transportApiService'
import {
    ATTENDANCE_PERIODS,
    ATTENDANCE_PHASES,
    SCHOOL_NAME,
    filterStudents,
    getAttendanceLocation,
    getLocationColumnLabel,
    getPhaseStats,
    statusStyles,
} from './studentAttendanceData'

const periodKey = (period) => period.toLowerCase()

const toIsoDate = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

const blankPhases = () => ({ pickup: 'Pending', drop: 'Pending' })

const assignmentToRecord = (row, scope) => ({
    id: `TMP-${row.studentId || row.id}`,
    studentId: row.studentId || '',
    studentName: row.studentName || '',
    classSection: row.classSection || '',
    busStop: row.stopName || row.busStop || '',
    profileImage: null,
    vehicleNumber: row.vehicleNumber || scope.vehicleNumber || '',
    routeName: row.routeName || scope.routeName || '',
    morning: blankPhases(),
    evening: blankPhases(),
})

const StudentAttendance = () => {
    const live = isLiveApiEnabled()
    const [attendanceDate, setAttendanceDate] = useState(new Date())
    const [period, setPeriod] = useState('Morning')
    const [phase, setPhase] = useState('pickup')
    const [search, setSearch] = useState('')
    const [records, setRecords] = useState([])
    const [scope, setScope] = useState({ vehicleNumber: '', routeName: '' })
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')
    const [savingId, setSavingId] = useState('')

    const load = useCallback(async () => {
        if (!live) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const dateKey = toIsoDate(attendanceDate)
        const [assignmentsRes, attendanceRes, vehiclesRes, routesRes] = await Promise.all([
            listTransportStudentAssignments(),
            listTransportStudentAttendance(),
            listTransportVehicles(),
            listTransportRoutes(),
        ])
        const parts = []
        if (!assignmentsRes.success) parts.push(`assignments: ${assignmentsRes.error}`)
        if (!attendanceRes.success) parts.push(`attendance: ${attendanceRes.error}`)
        if (!vehiclesRes.success) parts.push(`vehicles: ${vehiclesRes.error}`)
        if (!routesRes.success) parts.push(`routes: ${routesRes.error}`)
        setError(parts.join(' · '))

        const vehicleNumber = (vehiclesRes.data || [])[0]?.vehicleNumber || ''
        const routeName = (routesRes.data || [])[0]?.routeName || ''
        setScope({ vehicleNumber, routeName })

        const dayRows = (attendanceRes.data || []).filter((row) => String(row.attendanceDate || '') === dateKey)
        const byStudent = new Map(dayRows.map((row) => [String(row.studentId || row.id), row]))

        const assignments = assignmentsRes.data || []
        const roster = assignments.length
            ? assignments.map((row) => {
                const existing = byStudent.get(String(row.studentId || ''))
                if (existing) return existing
                return assignmentToRecord(row, { vehicleNumber, routeName })
            })
            : dayRows

        setRecords(roster)
        setLoading(false)
    }, [live, attendanceDate])

    useEffect(() => {
        load()
    }, [load])

    const filteredRecords = useMemo(
        () => filterStudents(records, search),
        [records, search],
    )

    const stats = useMemo(
        () => getPhaseStats(filteredRecords, period, phase),
        [filteredRecords, period, phase],
    )

    const phaseOptions = ATTENDANCE_PHASES[period]
    const activePhase = phaseOptions.find((item) => item.key === phase)
    const locationColumnLabel = getLocationColumnLabel(period, phase)

    const handlePeriodChange = (nextPeriod) => {
        setPeriod(nextPeriod)
        setPhase(ATTENDANCE_PHASES[nextPeriod][0].key)
    }

    const markAttendance = async (record, status) => {
        const dateKey = toIsoDate(attendanceDate)
        const bucket = periodKey(period)
        const nextMorning = { ...(record.morning || blankPhases()) }
        const nextEvening = { ...(record.evening || blankPhases()) }
        if (bucket === 'morning') nextMorning[phase] = status
        else nextEvening[phase] = status

        const payload = {
            id: String(record.id || '').startsWith('TMP-') ? '' : record.id,
            attendanceDate: dateKey,
            studentId: record.studentId,
            studentName: record.studentName,
            classSection: record.classSection,
            busStop: record.busStop,
            vehicleNumber: record.vehicleNumber || scope.vehicleNumber,
            routeName: record.routeName || scope.routeName,
            morning: nextMorning,
            evening: nextEvening,
        }

        if (!payload.vehicleNumber && !payload.routeName) {
            toast.error('No assigned vehicle/route in driver scope. Ask Transport Manager to link your profile.')
            return
        }

        setSavingId(record.studentId || record.id)
        const saved = await upsertTransportStudentAttendance(payload)
        setSavingId('')
        if (!saved.success) {
            toast.error(saved.error || 'Could not save attendance on the server.')
            return
        }
        toast.success(`${record.studentName || record.studentId} → ${status}`)
        await load()
    }

    const currentStatus = (record) => record[periodKey(period)]?.[phase] ?? 'Pending'

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Student boarding attendance uses GET/PUT /api/v1/ops/transport-student-attendance with roster from transport-student-assignments.'
            />
        )
    }

    return (
        <section className='space-y-5'>
            <div className='rounded-2xl overflow-hidden shadow-lg border border-[#515DEF33]'>
                <div className='bg-linear-to-r from-[#515DEF] via-[#4349D4] to-[#2E3192] px-4 md:px-6 py-5 text-white'>
                    <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
                        <div>
                            <p className='text-white/80 text-sm font-medium uppercase tracking-wide'>Daily Transport</p>
                            <h1 className='text-2xl md:text-3xl font-bold mt-1'>Student Attendance</h1>
                            <p className='text-white/85 text-sm mt-2 flex items-center gap-2'>
                                <Bus size={16} />
                                {scope.routeName || 'Assigned route'}
                                {' · '}
                                {scope.vehicleNumber || 'No vehicle'}
                            </p>
                            <p className='text-white/70 text-xs mt-1'>Live · /api/v1/ops/transport-student-attendance</p>
                        </div>
                        <div className='flex flex-col gap-1 min-w-[200px]'>
                            <label className='text-white/80 text-xs font-medium uppercase'>Attendance Date</label>
                            <div className='relative'>
                                <DatePicker
                                    selected={attendanceDate}
                                    onChange={(date) => setAttendanceDate(date)}
                                    dateFormat='dd-MM-yyyy'
                                    className='w-full text-sm text-[#1E1E1E] bg-white border-0 rounded-lg px-3 py-2.5 pr-10 focus:outline-none'
                                />
                                <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#515DEF] pointer-events-none' />
                            </div>
                        </div>
                    </div>

                    <div className='mt-5 flex flex-wrap gap-2'>
                        {ATTENDANCE_PERIODS.map((item) => (
                            <button
                                key={item}
                                type='button'
                                onClick={() => handlePeriodChange(item)}
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                                    period === item
                                        ? 'bg-white text-[#515DEF] shadow-md'
                                        : 'bg-white/15 text-white hover:bg-white/25'
                                }`}
                            >
                                {item === 'Morning' ? <Sun size={16} /> : <Moon size={16} />}
                                {item}
                            </button>
                        ))}
                    </div>

                    <div className='mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3'>
                        {phaseOptions.map((item) => (
                            <button
                                key={item.key}
                                type='button'
                                onClick={() => setPhase(item.key)}
                                className={`text-left rounded-xl px-4 py-3 border transition-all cursor-pointer ${
                                    phase === item.key
                                        ? 'bg-white text-[#515DEF] border-white shadow-md'
                                        : 'bg-white/10 text-white border-white/25 hover:bg-white/20'
                                }`}
                            >
                                <p className='font-semibold text-sm'>{item.label} Attendance</p>
                                <p className={`text-xs mt-0.5 ${phase === item.key ? 'text-[#667085]' : 'text-white/75'}`}>
                                    {item.subtitle}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className='bg-[#F4F6FF] px-4 md:px-6 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3'>
                    {[
                        { label: 'Total Students', value: stats.total, tone: 'text-[#515DEF]' },
                        { label: 'Present', value: stats.present, tone: 'text-[#2E7D32]' },
                        { label: 'Absent', value: stats.absent, tone: 'text-[#C62828]' },
                        { label: 'Pending', value: stats.pending, tone: 'text-[#F57F17]' },
                    ].map((item) => (
                        <div key={item.label} className='bg-white rounded-xl px-4 py-3 border border-[#E8EAFF]'>
                            <p className='text-xs text-[#667085] font-medium'>{item.label}</p>
                            <p className={`text-2xl font-bold mt-1 ${item.tone}`}>{item.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {loading ? <p className='text-sm text-slate-500'>Loading live boarding roster…</p> : null}
            {error ? <FeedbackState kind='error' title='Partial load issues' description={error} /> : null}

            <div className='bg-white rounded-2xl shadow-md border border-[#EDEEF5] p-4'>
                <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5'>
                    <div>
                        <h2 className='text-lg font-semibold text-[#1E1E1E]'>
                            {period}
                            {' '}
                            {activePhase?.label}
                            {' '}
                            List
                        </h2>
                        <p className='text-sm text-[#667085] mt-0.5'>
                            {period === 'Morning' && phase === 'pickup' && "Mark pickup at each student's respective bus stop."}
                            {period === 'Morning' && phase === 'drop' && `Mark drop at ${SCHOOL_NAME}.`}
                            {period === 'Evening' && phase === 'pickup' && `Mark pickup at ${SCHOOL_NAME}.`}
                            {period === 'Evening' && phase === 'drop' && "Mark drop at each student's respective bus stop."}
                        </p>
                    </div>
                    <div className='relative w-full md:max-w-sm'>
                        <Search size={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-[#808080]' />
                        <input
                            type='text'
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder='Search student ID, name, bus stop...'
                            className='w-full text-sm text-[#1E1E1E] border border-[#D9D9D9] rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-[#515DEF]'
                        />
                    </div>
                </div>

                <div className='hidden lg:grid grid-cols-[72px_1fr_1fr_1.2fr_auto] gap-4 px-4 py-3 bg-[#515DEF0D] rounded-xl text-xs font-semibold uppercase text-[#515DEF] tracking-wide'>
                    <span>Profile</span>
                    <span>Student ID & Name</span>
                    <span>Class & Section</span>
                    <span>{locationColumnLabel}</span>
                    <span className='text-center'>Attendance</span>
                </div>

                <div className='mt-3 space-y-3'>
                    {!loading && filteredRecords.length === 0 ? (
                        <div className='text-center py-12 text-[#667085]'>
                            No students in driver scope for this date. Assignments come from Transport Manager (`transport-student-assignments`).
                        </div>
                    ) : (
                        filteredRecords.map((record) => {
                            const status = currentStatus(record)
                            const busy = savingId === (record.studentId || record.id)
                            return (
                                <div
                                    key={record.id || record.studentId}
                                    className='rounded-2xl border border-[#EDEEF5] bg-[#FAFBFF] hover:border-[#515DEF44] hover:shadow-sm transition-all p-4'
                                >
                                    <div className='grid grid-cols-1 lg:grid-cols-[72px_1fr_1fr_1.2fr_auto] gap-4 lg:items-center'>
                                        <div className='flex items-center gap-3 lg:block'>
                                            <img
                                                src={record.profileImage || noProfile}
                                                alt={record.studentName}
                                                className='size-14 rounded-full object-cover border-2 border-white shadow-md'
                                            />
                                            <div className='lg:hidden'>
                                                <p className='font-semibold text-[#1E1E1E]'>{record.studentName}</p>
                                                <p className='text-xs text-[#667085]'>{record.studentId}</p>
                                            </div>
                                        </div>

                                        <div className='hidden lg:block'>
                                            <p className='font-semibold text-[#1E1E1E]'>{record.studentName}</p>
                                            <p className='text-sm text-[#667085] mt-0.5'>{record.studentId}</p>
                                        </div>

                                        <div>
                                            <p className='text-xs text-[#808080] lg:hidden mb-1'>Class & Section</p>
                                            <p className='text-sm font-medium text-[#1E1E1E]'>{record.classSection || '—'}</p>
                                        </div>

                                        <div>
                                            <p className='text-xs text-[#808080] lg:hidden mb-1'>{locationColumnLabel}</p>
                                            <p className='text-sm text-[#1E1E1E] inline-flex items-center gap-1.5'>
                                                <MapPin size={14} className='text-[#515DEF] shrink-0' />
                                                {getAttendanceLocation(record, period, phase)}
                                            </p>
                                        </div>

                                        <div className='flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-2 lg:min-w-[220px]'>
                                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-semibold border lg:hidden ${statusStyles[status]}`}>
                                                {status}
                                            </span>
                                            <button
                                                type='button'
                                                disabled={busy}
                                                onClick={() => markAttendance(record, 'Present')}
                                                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all cursor-pointer disabled:opacity-60 ${
                                                    status === 'Present'
                                                        ? 'bg-[#4CAF50] text-white border-[#4CAF50] shadow-sm'
                                                        : 'bg-white text-[#2E7D32] border-[#A5D6A7] hover:bg-[#E8F5E9]'
                                                }`}
                                            >
                                                <CheckCircle2 size={16} />
                                                Present
                                            </button>
                                            <button
                                                type='button'
                                                disabled={busy}
                                                onClick={() => markAttendance(record, 'Absent')}
                                                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all cursor-pointer disabled:opacity-60 ${
                                                    status === 'Absent'
                                                        ? 'bg-[#FF5722] text-white border-[#FF5722] shadow-sm'
                                                        : 'bg-white text-[#C62828] border-[#EF9A9A] hover:bg-[#FFEBEE]'
                                                }`}
                                            >
                                                <UserX size={16} />
                                                Absent
                                            </button>
                                        </div>
                                    </div>

                                    <div className='hidden lg:flex justify-end mt-2'>
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusStyles[status]}`}>
                                            {status === 'Present' && <CheckCircle2 size={12} />}
                                            {status === 'Absent' && <XCircle size={12} />}
                                            {status}
                                        </span>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </section>
    )
}

export default StudentAttendance
