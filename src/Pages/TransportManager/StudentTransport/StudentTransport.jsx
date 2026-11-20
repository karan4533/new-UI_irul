import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listStudents } from '../../../services/api/studentApiService'
import {
    listTransportRoutes,
    listTransportStudentAssignments,
    upsertTransportStudentAssignment,
} from '../../../services/api/transportApiService'

const emptyForm = {
    studentId: '',
    studentName: '',
    admissionNumber: '',
    classSection: '',
    routeId: '',
    routeName: '',
    stopName: '',
    vehicleNumber: '',
    status: 'Active',
}

const StudentTransport = () => {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [students, setStudents] = useState([])
    const [routes, setRoutes] = useState([])
    const [form, setForm] = useState(emptyForm)
    const [loading, setLoading] = useState(Boolean(live))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const loadGenRef = React.useRef(0)

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        const gen = ++loadGenRef.current
        setLoading(true)
        setError('')
        try {
            const a = await listTransportStudentAssignments()
            if (gen !== loadGenRef.current) return
            const s = await listStudents()
            if (gen !== loadGenRef.current) return
            const r = await listTransportRoutes()
            if (gen !== loadGenRef.current) return
            if (!a.success) {
                setError(typeof a.error === 'string' ? a.error : 'Failed to load student assignments.')
                setRows([])
                return
            }
            setRows(Array.isArray(a.data) ? a.data : [])
            setStudents(s.success && Array.isArray(s.data) ? s.data : [])
            setRoutes(r.success && Array.isArray(r.data) ? r.data : [])
        } finally {
            if (gen === loadGenRef.current) setLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
        return () => {
            loadGenRef.current += 1
        }
    }, [load])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((row) =>
            `${row.id} ${row.studentName} ${row.admissionNumber} ${row.routeName} ${row.stopName}`.toLowerCase().includes(q),
        )
    }, [rows, search])

    const onSelectStudent = (studentId) => {
        const student = students.find((row) => String(row.id) === String(studentId))
        setForm((prev) => ({
            ...prev,
            studentId,
            studentName: student?.name || '',
            admissionNumber: student?.admissionNumber || '',
            classSection: [student?.className || student?.class, student?.section].filter(Boolean).join('-'),
        }))
    }

    const onSelectRoute = (routeId) => {
        const route = routes.find((row) => String(row.id) === String(routeId))
        setForm((prev) => ({
            ...prev,
            routeId,
            routeName: route?.routeName || '',
            vehicleNumber: route?.vehicleNumber || '',
        }))
    }

    const handleSave = async () => {
        if (!form.studentId || !form.routeId) {
            toast.error('Student and route are required.')
            return
        }
        setSaving(true)
        const res = await upsertTransportStudentAssignment(form)
        setSaving(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not save assignment.')
            return
        }
        toast.success('Student transport assignment saved on the server.')
        setForm(emptyForm)
        setRows(res.rows || [])
    }

    return (
        <section className='space-y-6'>
            <div>
                <h1 className='text-2xl font-semibold text-black'>Student Transport</h1>
                <p className='text-sm text-[#667085] mt-1'>Persisted on /api/v1/ops/transport-student-assignments.</p>
            </div>
            {live ? <p className='text-xs font-medium text-[#027A48]'>Live · GET/PUT /api/v1/ops/transport-student-assignments</p> : null}
            {error ? <FeedbackState kind='error' title='Assignments API unavailable' description={error} /> : null}
            {loading ? <FeedbackState kind='loading' title='Loading assignments' description='Fetching student transport…' /> : null}

            {!loading && !error ? (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
                        <h2 className='text-lg font-semibold'>Allocate student to route</h2>
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Student</label>
                                <select
                                    value={form.studentId}
                                    onChange={(e) => onSelectStudent(e.target.value)}
                                    className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2'
                                >
                                    <option value=''>Select student</option>
                                    {students.map((student) => (
                                        <option key={student.id} value={student.id}>
                                            {student.name} ({student.admissionNumber || student.id})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Route</label>
                                <select
                                    value={form.routeId}
                                    onChange={(e) => onSelectRoute(e.target.value)}
                                    className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2'
                                >
                                    <option value=''>Select route</option>
                                    {routes.map((route) => (
                                        <option key={route.id} value={route.id}>
                                            {route.routeName || route.id}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Stop</label>
                                <input
                                    value={form.stopName}
                                    onChange={(e) => setForm((prev) => ({ ...prev, stopName: e.target.value }))}
                                    className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2'
                                />
                            </div>
                        </div>
                        <button type='button' disabled={saving} onClick={handleSave} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md disabled:opacity-60'>
                            {saving ? 'Saving…' : 'Save assignment'}
                        </button>
                    </div>

                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder='Search assignments…'
                            className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2 w-full md:max-w-sm mb-4'
                        />
                        <div className='overflow-x-auto'>
                            <table className='w-full text-sm text-left'>
                                <thead className='text-xs bg-[#EDEEF5]'>
                                    <tr>
                                        <th className='px-2 py-3'>ID</th>
                                        <th className='px-2 py-3'>Student</th>
                                        <th className='px-2 py-3'>Route / Stop</th>
                                        <th className='px-2 py-3'>Vehicle</th>
                                        <th className='px-2 py-3'>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={5} className='px-2 py-8 text-center text-[#667085]'>No assignment records.</td></tr>
                                    ) : filtered.map((row) => (
                                        <tr key={row.id} className='border-b border-[#f2f4f7]'>
                                            <td className='px-2 py-3'>{row.id}</td>
                                            <td className='px-2 py-3'>{row.studentName || row.studentId}</td>
                                            <td className='px-2 py-3'>{[row.routeName, row.stopName].filter(Boolean).join(' / ') || '—'}</td>
                                            <td className='px-2 py-3'>{row.vehicleNumber || '—'}</td>
                                            <td className='px-2 py-3'>{row.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : null}
        </section>
    )
}

export default StudentTransport
