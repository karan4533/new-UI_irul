import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    getMyGradeBand,
    getPlacementOptions,
    listPendingPlacement,
    placeStudent,
} from '../../../services/api/studentApiService'

/**
 * Live section placement for Coordinator (students.place).
 * Lists pending-placement students in the actor's grade band and posts section assignment.
 */
const CoordinatorStudentPlacement = () => {
    const live = isLiveApiEnabled()
    const [band, setBand] = useState(null)
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [sectionByStudent, setSectionByStudent] = useState({})
    const [optionsByClass, setOptionsByClass] = useState({})
    const [savingId, setSavingId] = useState('')

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const [bandRes, pendingRes] = await Promise.all([getMyGradeBand(), listPendingPlacement()])
        setLoading(false)
        if (!bandRes.success) {
            setError(typeof bandRes.error === 'string' ? bandRes.error : 'Failed to load grade band.')
            setBand(null)
            setRows([])
            return
        }
        if (!pendingRes.success) {
            setError(typeof pendingRes.error === 'string' ? pendingRes.error : 'Failed to load pending placement.')
            setRows([])
            return
        }
        setBand(bandRes.data)
        setRows(Array.isArray(pendingRes.data) ? pendingRes.data : [])
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const ensureOptions = async (className) => {
        if (!className || optionsByClass[className]) return
        const res = await getPlacementOptions(className)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : `Could not load sections for ${className}`)
            return
        }
        setOptionsByClass((prev) => ({ ...prev, [className]: res.data || null }))
    }

    const handlePlace = async (student) => {
        const sectionId = sectionByStudent[student.id]
        if (!sectionId) {
            toast.error('Select a section before placing.')
            return
        }
        setSavingId(student.id)
        const res = await placeStudent(student.id, sectionId)
        setSavingId('')
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Server rejected placement.')
            return
        }
        toast.success(`Placed ${student.name || student.admissionNumber} (server confirmed).`)
        await load()
    }

    if (!live) {
        return (
            <section>
                <FeedbackState
                    kind='error'
                    title='Live API required'
                    description='Student placement uses FastAPI students.place. Set VITE_USE_MOCK=false.'
                />
            </section>
        )
    }

    return (
        <section className='space-y-4'>
            <p className='text-xs font-medium text-[#027A48]'>
                Live student placement · GET /students/pending-placement · POST /students/{'{id}'}/place
            </p>
            {band ? (
                <p className='text-sm text-[#667085]'>
                    Your grade band: {band.gradeFrom}–{band.gradeTo}
                </p>
            ) : (
                <p className='text-sm text-amber-700'>
                    No grade band assigned. Ask Principal to set coordinator grade bands before placing students.
                </p>
            )}

            {error ? <FeedbackState kind='error' title='Placement API unavailable' description={error} /> : null}
            {loading ? <FeedbackState kind='loading' title='Loading pending placement' description='Fetching students awaiting section…' /> : null}

            {!loading && !error ? (
                <div className='bg-white rounded-2xl shadow-md p-4'>
                    <h2 className='text-xl font-medium text-black mb-4'>Pending section placement</h2>
                    <div className='relative overflow-x-auto'>
                        <table className='w-full text-sm text-left'>
                            <thead className='text-xs bg-[#EDEEF5]'>
                                <tr>
                                    <th className='px-2 py-3 text-[#0C1E5B] font-medium uppercase'>Admission</th>
                                    <th className='px-2 py-3 text-[#0C1E5B] font-medium uppercase'>Name</th>
                                    <th className='px-2 py-3 text-[#0C1E5B] font-medium uppercase'>Class</th>
                                    <th className='px-2 py-3 text-[#0C1E5B] font-medium uppercase'>Section</th>
                                    <th className='px-2 py-3 text-[#0C1E5B] font-medium uppercase'>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className='px-2 py-8 text-center text-[#667085]'>
                                            No students pending placement in your band.
                                        </td>
                                    </tr>
                                ) : rows.map((student) => {
                                    const opts = optionsByClass[student.className]
                                    const sections = opts?.sections || []
                                    return (
                                        <tr key={student.id} className='border-b border-[#f2f4f7]'>
                                            <td className='px-2 py-3'>{student.admissionNumber || '—'}</td>
                                            <td className='px-2 py-3 font-medium text-[#1E1E1E]'>{student.name || '—'}</td>
                                            <td className='px-2 py-3'>{student.className || '—'}</td>
                                            <td className='px-2 py-3'>
                                                <select
                                                    className='text-sm border border-[#D9D9D9] rounded-md px-2 py-1.5'
                                                    value={sectionByStudent[student.id] || ''}
                                                    onFocus={() => ensureOptions(student.className)}
                                                    onClick={() => ensureOptions(student.className)}
                                                    onChange={(e) => setSectionByStudent((prev) => ({
                                                        ...prev,
                                                        [student.id]: e.target.value,
                                                    }))}
                                                >
                                                    <option value=''>Select section…</option>
                                                    {sections.map((sec) => (
                                                        <option key={sec.id} value={sec.id}>{sec.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className='px-2 py-3'>
                                                <button
                                                    type='button'
                                                    disabled={savingId === student.id}
                                                    onClick={() => handlePlace(student)}
                                                    className='bg-[#515DEF] text-white text-sm px-3 py-1.5 rounded-md disabled:opacity-60'
                                                >
                                                    {savingId === student.id ? 'Saving…' : 'Place'}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}
        </section>
    )
}

export default CoordinatorStudentPlacement
