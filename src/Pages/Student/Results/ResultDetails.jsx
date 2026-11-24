import React, { useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import {
    CalendarRange,
    BadgePercent,
    BookOpenCheck,
    CircleCheck,
    ChevronLeft,
    ChevronRight,
    Calendar,
    Download,
    Star,
} from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import resultImg from '../../../assets/images/result-img.png'
import { useActiveStudent } from '../../../context/ActiveStudentContext'
import { getStudentResults } from '../../../services/api/examsApiService.js'

const EMPTY_SUMMARY = {
    examAppeared: 0,
    averagePercent: 0,
    highestMark: '—',
    highestSubject: '—',
    overallGrade: '—',
    hasData: false,
}

function buildPerformanceCategories(rows) {
    const buckets = [
        { label: 'Excellent', range: '90 - 100%', min: 90, max: 101, color: '#4CAF50', subjects: 0 },
        { label: 'Very Good', range: '75 - 89%', min: 75, max: 90, color: '#00B0FF', subjects: 0 },
        { label: 'Good', range: '50 - 74%', min: 50, max: 75, color: '#FF9800', subjects: 0 },
        { label: 'Need Improvement', range: '<50%', min: 0, max: 50, color: '#F44336', subjects: 0 },
    ]
    rows.forEach((row) => {
        if (row.resultStatus === 'Absent' || row.obtainedMarks === '—') return
        const match = String(row.percentage).match(/(\d+(\.\d+)?)/)
        const pct = match ? Number(match[1]) : null
        if (pct == null) return
        const bucket = buckets.find((item) => pct >= item.min && pct < item.max)
        if (bucket) bucket.subjects += 1
    })
    return buckets
}

const ResultDetails = () => {
    const [selectMonth, setSelectMonth] = useState(null)
    const { activeStudent } = useActiveStudent()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [rows, setRows] = useState([])
    const [summary, setSummary] = useState(EMPTY_SUMMARY)

    useEffect(() => {
        let cancelled = false
        async function load() {
            if (!activeStudent?.id) {
                setRows([])
                setSummary(EMPTY_SUMMARY)
                setLoading(false)
                return
            }
            setLoading(true)
            setError('')
            const res = await getStudentResults(activeStudent.id)
            if (cancelled) return
            if (!res.success) {
                setRows([])
                setSummary(EMPTY_SUMMARY)
                setError(res.error || 'Unable to load published exam results.')
                setLoading(false)
                return
            }
            setRows(res.data?.rows || [])
            setSummary(res.data?.summary || EMPTY_SUMMARY)
            setLoading(false)
        }
        load()
        return () => {
            cancelled = true
        }
    }, [activeStudent?.id])

    const bagdeColor = {
        Pass: 'bg-[#4CAF5033] text-[#4CAF50]',
        Fail: 'bg-[#FF000033] text-[#FF0000]',
        Absent: 'bg-[#FF980033] text-[#FF9800]',
    }

    const filteredRows = useMemo(() => {
        if (!selectMonth) return rows
        // Live results payload has no examDate yet — month filter is a no-op until dates exist.
        return rows
    }, [rows, selectMonth])

    const performanceCategories = useMemo(
        () => buildPerformanceCategories(filteredRows),
        [filteredRows],
    )

    const chartData = useMemo(
        () =>
            performanceCategories
                .filter((item) => item.subjects > 0)
                .map((item) => ({ name: item.label, value: item.subjects, color: item.color })),
        [performanceCategories],
    )

    const pieChartOption = useMemo(
        () => ({
            series: [
                {
                    type: 'pie',
                    radius: ['64%', '91%'],
                    center: ['50%', '50%'],
                    startAngle: 90,
                    padAngle: 3,
                    silent: true,
                    data:
                        chartData.length > 0
                            ? chartData.map((item) => ({
                                value: item.value,
                                name: item.name,
                                itemStyle: { color: item.color },
                            }))
                            : [{ value: 1, name: 'Empty', itemStyle: { color: '#E5E7EB' } }],
                    label: { show: false },
                    labelLine: { show: false },
                    emphasis: { disabled: true },
                },
            ],
        }),
        [chartData],
    )

    const encouragementName =
        activeStudent?.name?.split?.(' ')?.[0] || activeStudent?.firstName || 'Student'

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                    <div className='bg-[#F0F8FE] border border-[#D2E2F0] rounded-xl p-4'>
                        <div className='flex items-center gap-4'>
                            <div className='flex items-center justify-center w-20 h-20 rounded-full bg-[#BFD9F8] p-4'>
                                <CalendarRange className='text-[#515DEF] w-10 h-10' />
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <h3 className='text-lg font-bold text-[#0C1E5B]'>Exam Appeared</h3>
                                <span className='text-4xl font-bold text-[#0C1E5B]'>
                                    {loading ? '—' : summary.examAppeared}
                                </span>
                                <span className='text-sm font-medium text-[#0C1E5B]'>Published</span>
                            </div>
                        </div>
                    </div>
                    <div className='bg-[#F1FCF2] border border-[#D1E7CC] rounded-xl p-4'>
                        <div className='flex items-center gap-4'>
                            <div className='flex items-center justify-center w-20 h-20 rounded-full bg-[#C7E9C7] p-4'>
                                <BadgePercent className='text-[#0B6D2C] w-10 h-10' />
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <h3 className='text-lg font-bold text-[#0B6D2C]'>Average Percent</h3>
                                <span className='text-4xl font-bold text-[#0B6D2C]'>
                                    {loading || !summary.hasData ? '—' : `${summary.averagePercent} %`}
                                </span>
                                <span className='text-sm font-medium text-[#0B6D2C]'>Published</span>
                            </div>
                        </div>
                    </div>
                    <div className='bg-[#FDF3F4] border border-[#F5D7DA] rounded-xl p-4'>
                        <div className='flex items-center gap-4'>
                            <div className='flex items-center justify-center w-20 h-20 rounded-full bg-[#F2C9CB] p-4'>
                                <BookOpenCheck className='text-[#980E0F] w-10 h-10' />
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <h3 className='text-lg font-bold text-[#980E0F]'>Highest Mark</h3>
                                <span className='text-4xl font-bold text-[#980E0F]'>
                                    {loading ? '—' : summary.highestMark}
                                </span>
                                <span className='text-sm font-medium text-[#980E0F]'>
                                    {loading ? '—' : summary.highestSubject}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className='bg-[#F9F7FE] border border-[#DFDDEF] rounded-xl p-4'>
                        <div className='flex items-center gap-4'>
                            <div className='flex items-center justify-center w-20 h-20 rounded-full bg-[#E1D7FD] p-4'>
                                <CircleCheck className='text-[#2515B4] w-10 h-10' />
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <h3 className='text-lg font-bold text-[#2515B4]'>Overall Grade</h3>
                                <span className='text-4xl font-bold text-[#2515B4]'>
                                    {loading ? '—' : summary.overallGrade}
                                </span>
                                <span className='text-sm font-medium text-[#2515B4]'>Published</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 mt-6'>
                <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end'>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>Select Month</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={selectMonth}
                                onChange={(date) => setSelectMonth(date)}
                                isClearable={true}
                                showMonthYearPicker
                                dateFormat='MM/yyyy'
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-3 pr-10 focus:outline-none'
                            />
                            <Calendar
                                size={16}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none'
                            />
                        </div>
                    </div>

                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='exam-filter' className='text-base font-medium text-[#808080]'>
                            Exams Filter
                        </label>
                        <select
                            id='exam-filter'
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                            disabled
                        >
                            <option value=''>All</option>
                        </select>
                    </div>

                    <button
                        type='button'
                        disabled
                        className='bg-[#515DEF]/70 text-white flex items-center gap-x-2 justify-center uppercase text-sm px-6 py-3 border border-[#515DEF] rounded-lg cursor-not-allowed'
                    >
                        <Download className='w-4 h-4' />
                        Export
                    </button>

                    <button
                        type='button'
                        onClick={() => setSelectMonth(null)}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-3 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                    <h2 className='text-xl font-medium text-black'>Exam Result List</h2>
                </div>
                <div className='relative overflow-x-auto'>
                    <table className='w-full text-sm text-left rtl:text-right'>
                        <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                            <tr className='rounded-lg'>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>
                                    Exam Name
                                </th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Subject</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Total Marks</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>
                                    Obtained Marks
                                </th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Grade</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Percentage</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>
                                    Result Status
                                </th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>
                                    Teacher Remarks
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className='px-2 py-8 text-center text-[#667085]'>
                                        Loading published exam results…
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={8} className='px-2 py-8 text-center text-[#980E0F]'>
                                        {error}
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className='px-2 py-8 text-center text-[#667085]'>
                                        No approved exam results are available yet. Results will appear here
                                        after marks are published.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7] rounded-lg'
                                    >
                                        <td className='px-2 py-4 rounded-s-lg'>{row.examName}</td>
                                        <td className='px-2 py-4'>{row.subject}</td>
                                        <td className='px-2 py-4'>{row.totalMarks}</td>
                                        <td className='px-2 py-4'>{row.obtainedMarks}</td>
                                        <td className='px-2 py-4'>{row.grade}</td>
                                        <td className='px-2 py-4'>{row.percentage}</td>
                                        <td className='px-2 py-4'>
                                            <span
                                                className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${bagdeColor[row.resultStatus] ?? bagdeColor.Pass}`}
                                            >
                                                {row.resultStatus}
                                            </span>
                                        </td>
                                        <td className='px-2 py-4 rounded-e-lg'>{row.teacherRemarks}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className='flex justify-between items-center px-4 mt-4'>
                <p className='text-sm font-medium text-[#515DEF]'>
                    Showing {filteredRows.length} approved result{filteredRows.length !== 1 ? 's' : ''}
                </p>
                <div className='flex justify-center gap-x-2 flex-wrap'>
                    <button
                        type='button'
                        className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] rounded-full cursor-default'
                        disabled
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        type='button'
                        className='size-8 flex justify-center items-center p-2 bg-[#EDEDF5] text-[#515DEF] border border-[#E2E8F0] rounded-full cursor-default'
                        disabled
                    >
                        1
                    </button>
                    <button
                        type='button'
                        className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] rounded-full cursor-default'
                        disabled
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 mt-6'>
                <div className='bg-white rounded-2xl shadow-md p-6'>
                    <h3 className='text-xl font-bold text-[#0C1E5B] mb-6'>Professional Summary</h3>
                    <div className='flex items-center gap-6 flex-wrap md:flex-nowrap'>
                        <div className='relative w-[180px] h-[180px] shrink-0 mx-auto md:mx-0'>
                            <ReactECharts
                                option={pieChartOption}
                                style={{ height: '180px', width: '180px' }}
                                opts={{ renderer: 'svg' }}
                            />
                            <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
                                <span className='text-sm text-[#808080]'>Average</span>
                                <span className='text-2xl font-bold text-[#0C1E5B]'>
                                    {summary.hasData ? `${summary.averagePercent} %` : '—'}
                                </span>
                            </div>
                        </div>

                        <div className='flex flex-col gap-4 flex-1 w-full'>
                            {performanceCategories.map((item) => (
                                <div key={item.label} className='flex items-center justify-between gap-4'>
                                    <div className='flex items-center gap-2 min-w-0'>
                                        <span
                                            className='w-2.5 h-2.5 rounded-full shrink-0'
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span className='text-sm font-medium text-[#0C1E5B] truncate'>
                                            {item.label} ({item.range})
                                        </span>
                                    </div>
                                    <span className='text-sm text-[#808080] whitespace-nowrap shrink-0'>
                                        {item.subjects} Subject{item.subjects !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div
                    className='rounded-2xl shadow-md p-6 bg-cover bg-right bg-no-repeat min-h-[200px] flex items-center'
                    style={{ backgroundImage: `url(${resultImg})` }}
                >
                    <div className='flex items-center gap-4 max-w-[55%]'>
                        <Star className='w-14 h-14 md:w-16 md:h-16 text-[#0056D2] fill-[#0056D2] shrink-0' />
                        <div>
                            <h3 className='text-xl md:text-2xl lg:text-3xl font-bold text-[#0056D2] leading-tight'>
                                {summary.hasData
                                    ? `Great Job, ${encouragementName}!`
                                    : `Hello, ${encouragementName}!`}
                            </h3>
                            <p className='text-sm md:text-base text-[#0C1E5B] mt-2 leading-relaxed'>
                                {summary.hasData
                                    ? 'Published results from the school exam register are shown above.'
                                    : 'Your exam results will appear here once marks are published.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className='bg-[#F1FCF2] rounded-2xl shadow-md border border-[#D1E7CC] p-4 mt-6'>
                <span className='text-base text-[#808080]'>
                    <strong className='text-[#0B6D2C]'>Note:</strong> For any queries regarding results,
                    please contact your class teacher.
                </span>
            </div>
        </section>
    )
}

export default ResultDetails
