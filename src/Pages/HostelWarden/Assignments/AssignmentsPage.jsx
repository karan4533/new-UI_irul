import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listStudents } from '../../../services/api/studentApiService'
import { listHostelAssignments, upsertHostelAssignment } from '../../../services/api/hostelApiService'

const emptyForm = {
    studentId: '',
    studentName: '',
    admissionNumber: '',
    classSection: '',
    blockName: 'Block A',
    roomNumber: '',
    bedNumber: '',
    status: 'Active',
    checkInDate: new Date().toISOString().slice(0, 10),
    remarks: '',
}

const AssignmentsPage = () => {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [students, setStudents] = useState([])
    const [form, setForm] = useState(emptyForm)
    const [loading, setLoading] = useState(Boolean(live))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const [a, s] = await Promise.all([listHostelAssignments(), listStudents()])
        setLoading(false)
        if (!a.success) {
            setError(typeof a.error === 'string' ? a.error : 'Failed to load assignments.')
            setRows([])
            return
        }
        setRows(Array.isArray(a.data) ? a.data : [])
        setStudents(s.success && Array.isArray(s.data) ? s.data : [])
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((row) =>
            `${row.id} ${row.studentName} ${row.admissionNumber} ${row.roomNumber} ${row.bedNumber}`
                .toLowerCase()
                .includes(q),
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

    const handleSave = async () => {
        if (!form.studentId || !form.roomNumber || !form.bedNumber) {
            toast.error('Student, room and bed are required.')
            return
        }
        setSaving(true)
        const res = await upsertHostelAssignment(form)
        setSaving(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not save assignment.')
            return
        }
        toast.success('Hostel assignment saved on the server.')
        setForm(emptyForm)
        setRows(res.rows || [])
    }

    const handleVacate = async (row) => {
        setSaving(true)
        const res = await upsertHostelAssignment({
            ...row,
            status: 'Vacated',
            checkOutDate: new Date().toISOString().slice(0, 10),
        })
        setSaving(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not vacate assignment.')
            return
        }
        toast.success('Resident marked Vacated on the server.')
        setRows(res.rows || [])
    }

    return (
        <section className='space-y-6'>
            <div>
                <h1 className='text-2xl font-semibold text-black'>Hostel Assignments</h1>
                <p className='text-sm text-[#667085] mt-1'>
                    Allocate students to block/room/bed records persisted on /api/v1/ops/hostel-assignments.
                </p>
            </div>

            {live ? (
                <p className='text-xs font-medium text-[#027A48]'>Live · GET/PUT /api/v1/ops/hostel-assignments</p>
            ) : null}
            {error ? <FeedbackState kind='error' title='Assignments API unavailable' description={error} /> : null}
            {loading ? <FeedbackState kind='loading' title='Loading assignments' description='Fetching hostel assignments…' /> : null}

            {!loading && !error ? (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
                        <h2 className='text-lg font-semibold text-black'>Allocate / update resident</h2>
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
                                <label className='text-sm text-[#808080]'>Block</label>
                                <input value={form.blockName} onChange={(e) => setForm((p) => ({ ...p, blockName: e.target.value }))} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Room</label>
                                <input value={form.roomNumber} onChange={(e) => setForm((p) => ({ ...p, roomNumber: e.target.value }))} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Bed</label>
                                <input value={form.bedNumber} onChange={(e) => setForm((p) => ({ ...p, bedNumber: e.target.value }))} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Check-in date</label>
                                <input type='date' value={form.checkInDate} onChange={(e) => setForm((p) => ({ ...p, checkInDate: e.target.value }))} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                            </div>
                            <div className='flex flex-col gap-y-2 md:col-span-3'>
                                <label className='text-sm text-[#808080]'>Remarks</label>
                                <input value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                            </div>
                        </div>
                        <button type='button' disabled={saving} onClick={handleSave} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md disabled:opacity-60'>
                            {saving ? 'Saving…' : 'Save assignment'}
                        </button>
                    </div>

                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <div className='flex flex-wrap gap-3 mb-4'>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder='Search residents…'
                                className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2 w-full md:max-w-sm'
                            />
                        </div>
                        <div className='overflow-x-auto'>
                            <table className='w-full text-sm text-left'>
                                <thead className='text-xs bg-[#EDEEF5]'>
                                    <tr>
                                        <th className='px-2 py-3'>ID</th>
                                        <th className='px-2 py-3'>Student</th>
                                        <th className='px-2 py-3'>Block / Room / Bed</th>
                                        <th className='px-2 py-3'>Status</th>
                                        <th className='px-2 py-3'>Check-in</th>
                                        <th className='px-2 py-3'>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={6} className='px-2 py-8 text-center text-[#667085]'>No assignment records.</td></tr>
                                    ) : filtered.map((row) => (
                                        <tr key={row.id} className='border-b border-[#f2f4f7]'>
                                            <td className='px-2 py-3'>{row.id}</td>
                                            <td className='px-2 py-3'>{row.studentName || row.studentId}</td>
                                            <td className='px-2 py-3'>{[row.blockName, row.roomNumber, row.bedNumber].filter(Boolean).join(' / ')}</td>
                                            <td className='px-2 py-3'>{row.status}</td>
                                            <td className='px-2 py-3'>{row.checkInDate || '—'}</td>
                                            <td className='px-2 py-3'>
                                                {String(row.status).toLowerCase() !== 'vacated' ? (
                                                    <button type='button' disabled={saving} onClick={() => handleVacate(row)} className='text-[#FF0000] font-semibold hover:underline disabled:opacity-60'>
                                                        Vacate
                                                    </button>
                                                ) : '—'}
                                            </td>
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

export default AssignmentsPage
