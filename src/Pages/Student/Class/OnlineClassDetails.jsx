import React, { useState, useMemo } from 'react'
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar, ChevronLeft, ChevronRight, Video, ExternalLink } from "lucide-react";
import { IntegrationNotice } from '../../../Common/ui'
import { useAcademicsLiveCollection } from '../../../services/api/useAcademicsLiveCollection'
import { getOnlineClasses } from '../../Teacher/OnlineClass/onlineClassData'

const liveStatusToStudent = (status) => {
    const key = String(status || '').toLowerCase()
    if (key === 'completed') return 'Completed'
    if (key === 'live') return 'Live'
    return 'Upcoming'
}

const mapLiveRow = (row) => ({
    id: row.id || row.onlineClassId,
    className: row.classSection || [row.className, row.section].filter(Boolean).join('-') || '—',
    subject: row.subject || '—',
    teacher: row.teacherName || row.teacher || '—',
    date: row.date || '—',
    startTime: row.startTime || '',
    endTime: row.endTime || '',
    link: row.meetingLink || row.link || '',
    status: liveStatusToStudent(row.status),
})

const INITIAL_CLASSES = [
    {
        id: 'OC-101',
        className: 'Grade 10-A',
        subject: 'Mathematics',
        teacher: 'Sandy Selva',
        date: '24/02/2026',
        startTime: '04:00 PM',
        endTime: '05:30 PM',
        link: 'https://meet.google.com/abc-defg-hij',
        status: 'Completed',
    },
    {
        id: 'OC-102',
        className: 'Grade 12-A',
        subject: 'Science (Physics)',
        teacher: 'Dr. Subramanian',
        date: '24/02/2026',
        startTime: '09:00 AM',
        endTime: '10:00 AM',
        link: 'https://meet.google.com/qmis-phy-live',
        status: 'Live',
    },
    {
        id: 'OC-103',
        className: 'Grade 11-B',
        subject: 'English Literature',
        teacher: 'Ms. Jane Doe',
        date: '26/02/2026',
        startTime: '02:00 PM',
        endTime: '03:00 PM',
        link: 'https://zoom.us/j/91288966299?pwd=Abcdefg',
        status: 'Upcoming',
    },
    {
        id: 'OC-104',
        className: 'Grade 10-A',
        subject: 'Computer Applications',
        teacher: 'Mr. Vignesh P',
        date: '27/02/2026',
        startTime: '03:30 PM',
        endTime: '04:30 PM',
        link: 'https://meet.google.com/qmis-cs-lab',
        status: 'Upcoming',
    },
]

const OnlineClassDetails = () => {
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const { live, loading, error, version } = useAcademicsLiveCollection('online-classes')
    // Live: rows come only from academics `online-classes` (empty until hydrated); no demo seeds.
    const sourceClasses = useMemo(
        // eslint-disable-next-line react-hooks/exhaustive-deps
        () => (live ? getOnlineClasses().map(mapLiveRow) : INITIAL_CLASSES),
        [live, version],
    )

    const bagdeColor = {
        "Completed": "bg-slate-100 text-slate-700 border-slate-200",
        "Live": "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse",
        "Upcoming": "bg-amber-50 text-amber-700 border-amber-200",
    }

    const filteredClasses = useMemo(() => {
        return sourceClasses.filter((c) => {
            if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase()
                return (
                    String(c.subject).toLowerCase().includes(q) ||
                    String(c.className).toLowerCase().includes(q) ||
                    String(c.teacher).toLowerCase().includes(q)
                )
            }
            return true
        })
    }, [sourceClasses, searchTerm, statusFilter])

    return (
        <section>
            {live && error ? (
                <IntegrationNotice state='failed' title='Online classes unavailable' description={error} className='mb-4' />
            ) : null}
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                    <button
                        type='button'
                        onClick={() => {
                            setSearchTerm('')
                            setStatusFilter('ALL')
                        }}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-2 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'
                    >
                        Clear Filters
                    </button>
                    <select className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full md:max-w-xs sm:max-w-full'>
                        <option value="">Current Academic Term</option>
                    </select>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor="search" className='text-base font-medium text-[#808080]'>Search</label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder='Search subject, teacher...'
                            className='text-sm font-normal text-slate-800 border border-[#D9D9D9] rounded-md px-2 py-2 w-full focus:outline-none focus:border-[#515DEF]'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor="class" className='text-base font-medium text-[#808080]'>Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className='text-sm font-normal text-slate-800 border border-[#D9D9D9] rounded-md px-2 py-2 w-full focus:outline-none focus:border-[#515DEF]'
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="Live">Live Now</option>
                            <option value="Upcoming">Upcoming</option>
                            <option value="Completed">Completed</option>
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>From</label>

                        <div className='relative w-full'>
                            <DatePicker
                                selected={fromDate}
                                onChange={(date) => setFromDate(date)}
                                isClearable={true}
                                showMonthYearDropdown={true}
                                scrollableMonthYearDropdown={true}
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />

                            <Calendar
                                size={16}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none'
                            />
                        </div>
                    </div>

                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>To</label>

                        <div className='relative'>
                            <DatePicker
                                selected={toDate}
                                onChange={(date) => setToDate(date)}
                                isClearable={true}
                                showMonthYearDropdown={true}
                                scrollableMonthYearDropdown={true}
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />

                            <Calendar
                                size={16}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none'
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                    <h2 className='text-xl font-medium text-black'>Online Live Sessions</h2>
                </div>
                <div className="relative overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right">
                        <thead className="text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg">
                            <tr className='rounded-lg'>
                                <th className="px-3 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg">Class</th>
                                <th className="px-3 py-3.5 text-[#0C1E5B] font-medium uppercase">Subject</th>
                                <th className="px-3 py-3.5 text-[#0C1E5B] font-medium uppercase">Teacher</th>
                                <th className="px-3 py-3.5 text-[#0C1E5B] font-medium uppercase">Schedule Date</th>
                                <th className="px-3 py-3.5 text-[#0C1E5B] font-medium uppercase">Timings</th>
                                <th className="px-3 py-3.5 text-[#0C1E5B] font-medium uppercase text-center">Classroom Link</th>
                                <th className="px-3 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg text-center">Status</th>
                            </tr>
                        </thead>

                        <tbody className='divide-y divide-slate-100'>
                            {filteredClasses.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className='px-3 py-8 text-center text-sm text-slate-500'>
                                        {live && loading ? 'Loading online classes…' : 'No online classes scheduled.'}
                                    </td>
                                </tr>
                            ) : null}
                            {filteredClasses.map((item) => {
                                const isLive = item.status === 'Live'
                                return (
                                    <tr key={item.id} className="text-[#667085] hover:bg-slate-50 transition-colors">
                                        <td className="px-3 py-4 font-bold text-slate-800 rounded-s-lg">{item.className}</td>
                                        <td className="px-3 py-4 font-semibold text-slate-900">{item.subject}</td>
                                        <td className="px-3 py-4">{item.teacher}</td>
                                        <td className="px-3 py-4">{item.date}</td>
                                        <td className="px-3 py-4 text-xs font-medium text-slate-700">{item.startTime} – {item.endTime}</td>
                                        <td className="px-3 py-4 text-center">
                                            {item.link ? (
                                                <a
                                                    href={item.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                        isLive
                                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                    }`}
                                                >
                                                    <Video size={14} />
                                                    {isLive ? 'Join Live Now' : 'Open Link'}
                                                </a>
                                            ) : (
                                                <span className='text-xs text-slate-400'>No link available</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-4 text-center rounded-e-lg">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${bagdeColor[item.status]}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    )
}

export default OnlineClassDetails