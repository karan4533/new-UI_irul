import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { FeedbackState, PageHeader } from '../../../Common/ui'
import { listExams } from '../../../services/api/examsApiService'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'

const LiveExamDetailsList = () => {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setError('Live API is disabled.')
            setLoading(false)
            return
        }
        setLoading(true)
        setError('')
        const res = await listExams()
        setLoading(false)
        if (!res.success) {
            setError(typeof res.error === 'string' ? res.error : 'Failed to load exams.')
            setRows([])
            return
        }
        setRows(Array.isArray(res.data) ? res.data : [])
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((row) =>
            `${row.examName || ''} ${row.className || ''} ${row.examTypeName || row.examType || ''} ${row.academicYear || ''} ${row.approvalStatus || ''}`
                .toLowerCase()
                .includes(q),
        )
    }, [rows, search])

    return (
        <section className='space-y-4'>
            <PageHeader
                title='Exam details'
                description='Campus exam schedules from /api/v1/exams.'
                actions={(
                    <div className='flex gap-2'>
                        <button type='button' onClick={load} className='rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 py-2 text-sm font-semibold cursor-pointer'>
                            Refresh
                        </button>
                        <NavLink
                            to='/admin/exam-details/add-exam-details'
                            className='inline-flex items-center gap-2 rounded-lg bg-[#515DEF] px-3 py-2 text-sm font-semibold text-white'
                        >
                            <Plus size={16} />
                            Add exam
                        </NavLink>
                    </div>
                )}
            />

            {error ? <FeedbackState kind='error' title='Exams API unavailable' description={error} /> : null}
            {loading ? <FeedbackState kind='loading' title='Loading exams' description='Fetching exam schedules…' /> : null}

            {!loading && !error ? (
                <div className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
                    <input
                        type='text'
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder='Search exam, class, type…'
                        className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2 w-full max-w-md'
                    />
                    {filtered.length === 0 ? (
                        <FeedbackState kind='empty' title='No exams found' description='Create an exam schedule to populate this list.' />
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='w-full text-left text-xs'>
                                <thead>
                                    <tr className='border-b border-gray-100 text-[11px] text-gray-400'>
                                        <th className='pb-2.5 pr-3'>Exam</th>
                                        <th className='pb-2.5 pr-3'>Class</th>
                                        <th className='pb-2.5 pr-3'>Type</th>
                                        <th className='pb-2.5 pr-3'>Start</th>
                                        <th className='pb-2.5 pr-3'>End</th>
                                        <th className='pb-2.5 pr-3'>Year</th>
                                        <th className='pb-2.5'>Approval</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-gray-50'>
                                    {filtered.map((row) => (
                                        <tr key={row.id || row.examId}>
                                            <td className='py-2.5 pr-3 font-semibold text-gray-900'>{row.examName || '—'}</td>
                                            <td className='py-2.5 pr-3'>{row.className || '—'}</td>
                                            <td className='py-2.5 pr-3'>{row.examTypeName || row.examType || '—'}</td>
                                            <td className='py-2.5 pr-3'>{row.startDate || '—'}</td>
                                            <td className='py-2.5 pr-3'>{row.endDate || '—'}</td>
                                            <td className='py-2.5 pr-3'>{row.academicYear || '—'}</td>
                                            <td className='py-2.5'>{row.approvalStatus || row.status || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : null}
        </section>
    )
}

export default LiveExamDetailsList
