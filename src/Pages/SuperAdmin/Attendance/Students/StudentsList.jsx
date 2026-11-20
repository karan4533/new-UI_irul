import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import SuperAdminExportModal from '../../utils/SuperAdminExportModal'
import AttendanceOverviewSection from '../Components/AttendanceOverviewSection'
import { FeedbackState, IntegrationNotice } from '../../../../Common/ui'
import {
    CLASS_OPTIONS,
    filterStudentAttendance,
    SECTION_OPTIONS,
    statusBadgeColor,
    STUDENT_ATTENDANCE,
} from '../../../Admin/Attendance/Students/studentAttendanceData'
import { isLiveApiEnabled } from '../../../../services/api/tokenStore'
import { listAttendance } from '../../../../services/api/attendanceApiService'

const emptyFilters = { search: '', className: '', section: '' }

const toIsoDate = (value) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ''
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

const mapLiveRow = (row) => ({
    id: row.id || row.studentId,
    admissionNo: row.admissionNumber || '—',
    studentName: row.studentName || '—',
    className: row.className || '—',
    section: row.section || '—',
    onTime: row.inOutStatus || '—',
    outTime: '—',
    status: row.attendanceStatus || row.status || 'Unmarked',
})

const StudentsList = () => {
    const live = isLiveApiEnabled()
    const [filters, setFilters] = useState(emptyFilters)
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [exportModal, setExportModal] = useState(false)
    const [records, setRecords] = useState(() => (live ? [] : STUDENT_ATTENDANCE))
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [source, setSource] = useState(live ? 'backend' : 'demo')

    const loadLive = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setRecords(STUDENT_ATTENDANCE)
            setSource('demo')
            setLoading(false)
            setError('')
            return
        }
        const date = toIsoDate(selectedDate || new Date())
        if (!date) {
            setError('Select a valid attendance date.')
            setRecords([])
            setSource('error')
            setLoading(false)
            return
        }
        setLoading(true)
        setError('')
        const res = await listAttendance({
            date,
            className: filters.className || undefined,
            section: filters.section || undefined,
        })
        setLoading(false)
        if (!res.success) {
            setSource('error')
            setError(typeof res.error === 'string' ? res.error : 'Attendance API unavailable.')
            setRecords([])
            return
        }
        setRecords((Array.isArray(res.data) ? res.data : []).map(mapLiveRow))
        setSource('backend')
    }, [filters.className, filters.section, selectedDate])

    useEffect(() => {
        loadLive()
    }, [loadLive])

    const filteredRecords = useMemo(
        () => filterStudentAttendance(records, filters),
        [filters, records],
    )

    const clearFilters = () => {
        setFilters(emptyFilters)
        setSelectedDate(new Date())
    }

    return (
        <section className='space-y-6'>
            <IntegrationNotice
                state={source === 'backend' ? 'connected' : source === 'error' ? 'failed' : 'demo'}
                title={source === 'backend' ? 'Live student attendance' : source === 'error' ? 'Attendance API unavailable' : 'Demo attendance rows'}
                description={source === 'backend'
                    ? `GET /api/v1/attendance?date=${toIsoDate(selectedDate)} · Super Admin read path`
                    : source === 'error'
                        ? error
                        : 'Showing local demo rows because live API is disabled. Export will still generate a valid PDF from the visible table.'}
            />

            {source !== 'error' ? (
                <AttendanceOverviewSection
                    records={filteredRecords}
                    groupKey='className'
                    groupChartTitle='Class-wise Attendance Rate'
                    weeklyTrendLabel='Student Attendance'
                />
            ) : null}

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4 mb-4'>
                    <button
                        type='button'
                        onClick={clearFilters}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-1.5 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'
                    >
                        Clear Filters
                    </button>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='search' className='text-base font-medium text-[#808080]'>Search</label>
                        <input
                            id='search'
                            type='text'
                            value={filters.search}
                            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                            placeholder='Admission no, student name...'
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='class-filter' className='text-base font-medium text-[#808080]'>Class</label>
                        <select
                            id='class-filter'
                            value={filters.className}
                            onChange={(event) => setFilters((current) => ({ ...current, className: event.target.value }))}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All Classes</option>
                            {CLASS_OPTIONS.map((className) => (
                                <option key={className} value={className}>{className}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='section-filter' className='text-base font-medium text-[#808080]'>Section</label>
                        <select
                            id='section-filter'
                            value={filters.section}
                            onChange={(event) => setFilters((current) => ({ ...current, section: event.target.value }))}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All Sections</option>
                            {SECTION_OPTIONS.map((section) => (
                                <option key={section} value={section}>{section}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>Date</label>
                        <div className='relative'>
                            <DatePicker
                                selected={selectedDate}
                                onChange={setSelectedDate}
                                dateFormat='dd/MM/yyyy'
                                isClearable
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                </div>
            </div>

            {loading ? <FeedbackState kind='loading' title='Loading attendance' description='Fetching attendance marks…' /> : null}
            {source === 'error' ? <FeedbackState kind='error' title='Attendance API unavailable' description={error} /> : null}

            {!loading && source !== 'error' ? (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4 mt-2'>
                        <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                            <h2 className='text-xl font-medium text-black'>Student Attendance</h2>
                            <button
                                type='button'
                                onClick={() => setExportModal(true)}
                                className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                            >
                                <Download size={16} />
                                Export
                            </button>
                        </div>
                        <div className='relative overflow-x-auto'>
                            <table className='w-full text-sm text-left'>
                                <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                                    <tr>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Admission No</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Student Name</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Class</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Section</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>On Time</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Out Time</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className='px-2 py-8 text-center text-[#667085]'>
                                                No attendance rows for this date/filter.
                                            </td>
                                        </tr>
                                    ) : filteredRecords.map((record) => (
                                        <tr key={record.id} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7]'>
                                            <td className='px-2 py-4 font-medium text-[#1E1E1E] rounded-s-lg'>{record.admissionNo}</td>
                                            <td className='px-2 py-4'>{record.studentName}</td>
                                            <td className='px-2 py-4'>{record.className}</td>
                                            <td className='px-2 py-4'>{record.section}</td>
                                            <td className='px-2 py-4'>{record.onTime}</td>
                                            <td className='px-2 py-4'>{record.outTime}</td>
                                            <td className='px-2 py-4 rounded-e-lg'>
                                                <span className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${statusBadgeColor[record.status] || 'bg-slate-100 text-slate-700'}`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className='flex justify-between items-center px-4 mt-4'>
                        <p className='text-sm font-medium text-[#515DEF]'>
                            Showing {filteredRecords.length} of {filteredRecords.length} entries
                        </p>
                        <div className='flex gap-x-2'>
                            <button type='button' className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] rounded-full cursor-pointer' disabled>
                                <ChevronLeft size={16} />
                            </button>
                            <button type='button' className='size-8 flex justify-center items-center p-2 bg-[#515DEF] text-white border border-[#515DEF] rounded-full cursor-pointer'>
                                1
                            </button>
                            <button type='button' className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] rounded-full cursor-pointer' disabled>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    <SuperAdminExportModal
                        exportModal={exportModal}
                        setExportModal={setExportModal}
                        recordCount={filteredRecords.length}
                        documentTitle='Super Admin · Student attendance'
                        getExportLines={() => filteredRecords.map((row) => (
                            `${row.admissionNo} | ${row.studentName} | ${row.className}-${row.section} | ${row.status}`
                        ))}
                    />
                </>
            ) : null}
        </section>
    )
}

export default StudentsList
