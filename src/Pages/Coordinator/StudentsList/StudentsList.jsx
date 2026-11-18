import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Download, Eye } from 'lucide-react'
import mo_user from '../../../assets/images/no-profile.png'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import { FeedbackState } from '../../../Common/ui'
import { GENDERS, getStudentsList } from './studentsListData'
import { CLASSES, SECTIONS } from '../AssignedClass/assignedClassData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listStudents } from '../../../services/api/studentApiService'

const ROUTE_BASE = '/coordinator/user-management/students-list'

const StudentsList = () => {
    const live = isLiveApiEnabled()
    const [exportModal, setExportModal] = useState(false)
    const [search, setSearch] = useState('')
    const [classFilter, setClassFilter] = useState('')
    const [sectionFilter, setSectionFilter] = useState('')
    const [genderFilter, setGenderFilter] = useState('')
    const [rows, setRows] = useState(() => (live ? [] : getStudentsList()))
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [source, setSource] = useState(live ? 'backend' : 'local')

    const loadLive = useCallback(async () => {
        setLoading(true)
        setError('')
        const res = await listStudents()
        setLoading(false)
        if (!res.success) {
            setSource('error')
            setError(typeof res.error === 'string' ? res.error : 'Failed to load students.')
            setRows([])
            return
        }
        setRows(Array.isArray(res.data) ? res.data : [])
        setSource('backend')
    }, [])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setRows(getStudentsList())
            setSource('local')
            setLoading(false)
            return
        }
        loadLive()
    }, [loadLive])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        return rows.filter((student) => {
            if (classFilter && (student.className || '') !== classFilter && !String(student.className || '').includes(classFilter)) {
                return false
            }
            if (sectionFilter && (student.section || '') !== sectionFilter) return false
            if (genderFilter && (student.gender || '') !== genderFilter) return false
            if (!q) return true
            const hay = `${student.admissionNumber || ''} ${student.name || ''} ${student.email || ''} ${student.id || ''}`.toLowerCase()
            return hay.includes(q)
        })
    }, [rows, search, classFilter, sectionFilter, genderFilter])

    return (
        <section>
            {source === 'backend' ? (
                <p className='mb-3 text-xs font-medium text-[#027A48]'>
                    Live roster · GET /api/v1/students (coordinator grade-band + teaching allocations)
                </p>
            ) : null}
            {source === 'error' ? (
                <FeedbackState kind='error' title='Students API unavailable' description={error} />
            ) : null}
            {loading ? (
                <FeedbackState kind='loading' title='Loading students' description='Fetching students in your grade band…' />
            ) : null}

            {!loading && source !== 'error' ? (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                            <button
                                type='button'
                                onClick={() => {
                                    setSearch('')
                                    setClassFilter('')
                                    setSectionFilter('')
                                    setGenderFilter('')
                                }}
                                className='bg-[#515DEF] text-white uppercase text-sm px-6 py-2 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'
                            >
                                Clear Filters
                            </button>
                        </div>
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-base font-medium text-[#808080]'>Search</label>
                                <input
                                    type='text'
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder='Admission no, name...'
                                    className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                                />
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-base font-medium text-[#808080]'>Class</label>
                                <select
                                    value={classFilter}
                                    onChange={(e) => setClassFilter(e.target.value)}
                                    className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                                >
                                    <option value=''>All</option>
                                    {CLASSES.map((item) => (
                                        <option key={item} value={live ? `Grade ${item}` : item}>
                                            Class {item}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-base font-medium text-[#808080]'>Section</label>
                                <select
                                    value={sectionFilter}
                                    onChange={(e) => setSectionFilter(e.target.value)}
                                    className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                                >
                                    <option value=''>All</option>
                                    {SECTIONS.map((item) => (
                                        <option key={item} value={item}>Section {item}</option>
                                    ))}
                                </select>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-base font-medium text-[#808080]'>Gender</label>
                                <select
                                    value={genderFilter}
                                    onChange={(e) => setGenderFilter(e.target.value)}
                                    className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                                >
                                    <option value=''>All</option>
                                    {GENDERS.map((gender) => (
                                        <option key={gender} value={gender}>{gender}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                        <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                            <div>
                                <h2 className='text-xl font-medium text-black'>Students List</h2>
                                <p className='text-sm text-[#667085] mt-1'>Showing {filtered.length} of {rows.length} students</p>
                            </div>
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
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Profile</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Admission Number</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Name</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Class</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Section</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Gender</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Email</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Mobile</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Status</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className='px-2 py-8 text-center text-[#667085]'>
                                                {live
                                                    ? 'No students in your grade band yet (Principal must assign a grade band; empty band ⇒ empty list).'
                                                    : 'No students found.'}
                                            </td>
                                        </tr>
                                    ) : filtered.map((student) => (
                                        <tr key={student.id} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7]'>
                                            <td className='px-2 py-3'><img src={mo_user} alt='' className='w-9 h-9 rounded-full object-cover' /></td>
                                            <td className='px-2 py-3'>{student.admissionNumber || '—'}</td>
                                            <td className='px-2 py-3 text-[#1E1E1E] font-medium'>{student.name || '—'}</td>
                                            <td className='px-2 py-3'>{student.className || '—'}</td>
                                            <td className='px-2 py-3'>{student.section || '—'}</td>
                                            <td className='px-2 py-3'>{student.gender || '—'}</td>
                                            <td className='px-2 py-3'>{student.email || '—'}</td>
                                            <td className='px-2 py-3'>{student.mobileNumber || '—'}</td>
                                            <td className='px-2 py-3'>{student.status || '—'}</td>
                                            <td className='px-2 py-3'>
                                                <div className='flex items-center gap-2'>
                                                    <NavLink to={`${ROUTE_BASE}/view/${student.id}`} className='text-[#515DEF] font-semibold hover:underline'>View</NavLink>
                                                    <NavLink
                                                        to={`${ROUTE_BASE}/view/${student.id}/full`}
                                                        className='inline-flex items-center gap-1 text-xs text-blue-700 hover:underline'
                                                    >
                                                        <Eye size={12} /> Full
                                                    </NavLink>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <ExportModal exportModal={exportModal} setExportModal={setExportModal} recordCount={filtered.length} />
                </>
            ) : null}
        </section>
    )
}

export default StudentsList
