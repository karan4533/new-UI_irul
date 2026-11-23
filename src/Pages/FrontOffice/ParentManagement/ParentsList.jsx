import React, { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar, EllipsisIcon, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import Dropdown from '../../../Common/CommonComponents/Dropdown'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import EditRequestModal from '../../../Common/CommonComponents/EditRequestModal'
import { FeedbackState } from '../../../Common/ui'
import { PARENTS_LIST } from './parentDatabaseData'
import { listParents } from '../../../services/api/parentsApiService'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'

const ParentsList = () => {
    const live = isLiveApiEnabled()
    const [fromDate, setFromDate] = useState(new Date())
    const [toDate, setToDate] = useState(new Date())
    const [exportModal, setExportModal] = useState(false)
    const [editRequestModal, setEditRequestModal] = useState(false)
    const [search, setSearch] = useState('')
    const [rows, setRows] = useState(() => (live ? [] : PARENTS_LIST))
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [pageSize, setPageSize] = useState(10)
    const [page, setPage] = useState(1)

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setRows(PARENTS_LIST)
            setLoading(false)
            return undefined
        }
        let cancelled = false
        setLoading(true)
        setError('')
        listParents().then((res) => {
            if (cancelled) return
            setLoading(false)
            if (!res.success) {
                setError(typeof res.error === 'string' ? res.error : 'Parents could not be loaded.')
                setRows([])
                return
            }
            setRows(Array.isArray(res.data) ? res.data : [])
        })
        return () => { cancelled = true }
    }, [])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((parent) =>
            [parent.parentName, parent.studentName, parent.admissionNumber, parent.email, parent.mobileNumber]
                .some((value) => String(value || '').toLowerCase().includes(q)),
        )
    }, [rows, search])

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                    <button
                        type='button'
                        onClick={() => { setSearch(''); setPage(1) }}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-2 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'
                    >
                        Clear Filters
                    </button>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='search' className='text-base font-medium text-[#808080]'>Search</label>
                        <input
                            type='text'
                            id='search'
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                            placeholder='Parent name, student name...'
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>From</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={fromDate}
                                onChange={(date) => setFromDate(date)}
                                isClearable
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>To</label>
                        <div className='relative'>
                            <DatePicker
                                selected={toDate}
                                onChange={(date) => setToDate(date)}
                                isClearable
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                </div>
            </div>

            {live && loading ? (
                <FeedbackState kind='loading' title='Loading parents' description='Fetching parent contacts…' />
            ) : null}
            {live && error ? (
                <FeedbackState kind='error' title='Parents unavailable' description={error} />
            ) : null}

            {!loading && !error ? (
                <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                    <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                        <h2 className='text-xl font-medium text-black'>Parents List</h2>
                        <button
                            type='button'
                            onClick={() => setExportModal(true)}
                            className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                        >
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                    <div className='flex gap-x-2 items-center my-2'>
                        <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                            className='px-2 py-1.5 bg-white text-[#515DEF] border border-[#515DEF] rounded-md'
                        >
                            {[10, 20, 30, 40, 50].map((size) => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                        <span className='text-sm font-normal text-[#515DEF]'>Entries Per Page</span>
                    </div>
                    <div className='relative overflow-x-auto'>
                        <table className='w-full text-sm text-left rtl:text-right'>
                            <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                                <tr className='rounded-lg'>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Profile</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Parent ID</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Parent Name</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Gender</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Email</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Mobile Number</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Student Name</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Admission Number</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Relation</th>
                                    <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className='px-2 py-8 text-center text-[#667085]'>
                                            No parent records found.
                                        </td>
                                    </tr>
                                ) : null}
                                {pageRows.map((parent) => (
                                    <tr key={parent.id} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7] rounded-lg'>
                                        <td className='px-2 py-4 object-cover flex justify-center rounded-s-lg'>
                                            <img src={parent.profileImage} alt={parent.parentName} className='w-9 h-9 rounded-full object-cover' />
                                        </td>
                                        <td className='px-2 py-4'>{parent.parentId}</td>
                                        <td className='px-2 py-4 font-medium text-[#1E1E1E]'>{parent.parentName}</td>
                                        <td className='px-2 py-4'>{parent.gender}</td>
                                        <td className='px-2 py-4'>{parent.email}</td>
                                        <td className='px-2 py-4'>{parent.mobileNumber}</td>
                                        <td className='px-2 py-4'>{parent.studentName}</td>
                                        <td className='px-2 py-4'>{parent.admissionNumber}</td>
                                        <td className='px-2 py-4'>{parent.relation}</td>
                                        <td className='px-2 py-4 text-center rounded-e-lg'>
                                            <Dropdown buttonContent={<EllipsisIcon size={16} className='text-black' />}>
                                                <NavLink to='/front-office/view-parent' state={{ parent }} className='w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'>
                                                    View
                                                </NavLink>
                                                <button type='button' onClick={() => setEditRequestModal(true)} className='w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'>
                                                    Edit
                                                </button>
                                            </Dropdown>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}

            {!loading && !error ? (
                <div className='flex justify-between items-center px-4 mt-4'>
                    <p className='text-sm font-medium text-[#515DEF]'>
                        Showing {filtered.length === 0 ? 0 : ((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} entries
                    </p>
                    <div className='flex justify-center gap-x-2 flex-wrap'>
                        <button
                            type='button'
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer disabled:opacity-40'
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button type='button' className='size-8 flex justify-center items-center p-2 bg-[#EDEDF5] text-[#515DEF] border border-[#E2E8F0] rounded-full cursor-pointer'>
                            {page}
                        </button>
                        <button
                            type='button'
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer disabled:opacity-40'
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            ) : null}

            <ExportModal exportModal={exportModal} setExportModal={setExportModal} />
            <EditRequestModal editRequestModal={editRequestModal} setEditRequestModal={setEditRequestModal} />
        </section>
    )
}

export default ParentsList
