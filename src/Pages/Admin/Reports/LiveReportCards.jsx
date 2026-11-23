import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { FeedbackState, PageHeader, Surface } from '../../../Common/ui'
import { apiClient } from '../../../services/api/apiClient'
import { listStudents } from '../../../services/api/studentApiService'

const inputClass = 'min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'

/**
 * Admin Progress Report Cards — live student exam results (VITE_USE_MOCK=false). No sample students.
 */
const LiveReportCards = () => {
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [className, setClassName] = useState('')
    const [studentId, setStudentId] = useState('')
    const [results, setResults] = useState(null)
    const [resultsLoading, setResultsLoading] = useState(false)
    const [resultsError, setResultsError] = useState('')

    const loadStudents = useCallback(async () => {
        setLoading(true)
        setError('')
        const res = await listStudents()
        setLoading(false)
        if (!res.success) {
            setStudents([])
            setError(typeof res.error === 'string' ? res.error : 'Students could not be loaded.')
            return
        }
        setStudents(Array.isArray(res.data) ? res.data : [])
    }, [])

    useEffect(() => {
        loadStudents()
    }, [loadStudents])

    useEffect(() => {
        if (!studentId) return undefined
        let cancelled = false
        ;(async () => {
            setResultsLoading(true)
            setResultsError('')
            const res = await apiClient.get(`/api/v1/results/students/${encodeURIComponent(studentId)}`, { skipMock: true })
            if (cancelled) return
            setResultsLoading(false)
            if (!res.success) {
                setResults(null)
                setResultsError(typeof res.error === 'string' ? res.error : 'Results could not be loaded.')
                return
            }
            setResults(res.data || null)
        })()
        return () => { cancelled = true }
    }, [studentId])

    const classOptions = useMemo(
        () => [...new Set(students.map((s) => s.className).filter(Boolean))].sort(),
        [students],
    )
    const visibleStudents = useMemo(
        () => students.filter((s) => !className || s.className === className),
        [students, className],
    )

    if (loading) return <FeedbackState kind='loading' title='Loading students' description='Fetching student directory…' />
    if (error) {
        return (
            <FeedbackState
                kind='error'
                title='Unable to load students'
                description={error}
                action={<button type='button' onClick={loadStudents} className='text-sm font-semibold text-[#515DEF] hover:underline cursor-pointer'>Retry</button>}
            />
        )
    }

    return (
        <section className='space-y-5'>
            <PageHeader title='Progress report cards' description='Select a student to view published exam results.' />

            <Surface contentClassName='p-4 sm:p-5'>
                <div className='grid gap-3 md:grid-cols-3'>
                    <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)]'>Class
                        <select value={className} onChange={(e) => { setClassName(e.target.value); setStudentId(''); setResults(null) }} className={inputClass}>
                            <option value=''>All classes</option>
                            {classOptions.map((c) => <option key={c}>{c}</option>)}
                        </select>
                    </label>
                    <label className='grid gap-1 text-xs font-medium text-[var(--erp-slate)] md:col-span-2'>Student
                        <select value={studentId} onChange={(e) => { setStudentId(e.target.value); setResults(null) }} className={inputClass}>
                            <option value=''>Select a student…</option>
                            {visibleStudents.map((s) => (
                                <option key={s.id} value={s.id}>{s.admissionNumber || s.id} · {s.name} · {s.classSection || s.className}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </Surface>

            {!studentId ? (
                <FeedbackState kind='empty' title='No student selected' description='Choose a student to see their report card.' compact />
            ) : resultsLoading ? (
                <FeedbackState kind='loading' title='Loading results' description='Fetching exam results…' compact />
            ) : resultsError ? (
                <FeedbackState kind='error' title='Unable to load results' description={resultsError} compact />
            ) : results ? (
                <div className='space-y-4'>
                    <Surface
                        title={results.studentName}
                        description={`Class ${results.className || '—'}`}
                        actions={(
                            <button type='button' onClick={() => window.print()} className='inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm font-semibold cursor-pointer'>
                                <Printer aria-hidden='true' size={15} /> Print
                            </button>
                        )}
                        contentClassName='p-4 sm:p-5'
                    >
                        {results.weighted ? (
                            <p className='text-sm text-[var(--erp-ink)]'>
                                Weighted final: <span className='font-semibold'>{results.weighted.finalPercentage}%</span>
                                {results.weighted.complete ? '' : ' (some exam types are still pending)'}
                            </p>
                        ) : (
                            <p className='text-sm text-[var(--erp-slate)]'>No weighted final is available yet.</p>
                        )}
                    </Surface>

                    {(results.exams || []).length === 0 ? (
                        <FeedbackState kind='empty' title='No exam results yet' description='No marks have been recorded for this student.' compact />
                    ) : (
                        results.exams.map((exam) => (
                            <Surface
                                key={exam.examId}
                                title={exam.examName}
                                description={`${exam.examType} · Class ${exam.className}${exam.section ? `-${exam.section}` : ''}${exam.academicYear ? ` · ${exam.academicYear}` : ''}`}
                                contentClassName='p-4 sm:p-5'
                            >
                                <div className='overflow-x-auto'>
                                    <table className='w-full text-left text-sm'>
                                        <thead>
                                            <tr className='border-b border-[var(--erp-line)] text-xs text-[var(--erp-slate)]'>
                                                <th className='py-2 pr-4 font-semibold'>Subject</th>
                                                <th className='py-2 pr-4 font-semibold'>Marks</th>
                                                <th className='py-2 font-semibold'>Maximum</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(exam.subjects || []).map((subject) => (
                                                <tr key={subject.subject} className='border-b border-[var(--erp-line)] last:border-b-0'>
                                                    <td className='py-2 pr-4'>{subject.subject}</td>
                                                    <td className='py-2 pr-4'>{subject.absent ? 'Absent' : subject.marks ?? '—'}</td>
                                                    <td className='py-2'>{subject.maxMarks}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className='mt-3 text-sm text-[var(--erp-ink)]'>
                                    Total {exam.total} / {exam.maxTotal} · <span className='font-semibold'>{exam.percentage}%</span> · Rank {exam.rank}
                                </p>
                            </Surface>
                        ))
                    )}
                </div>
            ) : null}
        </section>
    )
}

export default LiveReportCards
