import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Download } from 'lucide-react'
import mo_user from '../../../../assets/images/no-profile.png'
import SuperAdminExportModal from '../../utils/SuperAdminExportModal'
import { FeedbackState } from '../../../../Common/ui'
import { DEPARTMENTS, EMPLOYEES_LIST, ROUTE_BASE } from './employeeDatabaseData'
import { isLiveApiEnabled } from '../../../../services/api/tokenStore'
import { listPortalEmployees } from '../../../../services/api/hrApiService'

const EmployeesList = () => {
    const live = isLiveApiEnabled()
    const [exportModal, setExportModal] = useState(false)
    const [search, setSearch] = useState('')
    const [departmentFilter, setDepartmentFilter] = useState('')
    const [rows, setRows] = useState(() => (live ? [] : EMPLOYEES_LIST))
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [source, setSource] = useState(live ? 'backend' : 'local')

    const loadLive = useCallback(async () => {
        setLoading(true)
        setError('')
        const res = await listPortalEmployees()
        setLoading(false)
        if (!res.success) {
            setSource('error')
            setError(typeof res.error === 'string' ? res.error : 'Failed to load employees.')
            setRows([])
            return
        }
        const mapped = (res.data || []).map((row) => ({
            ...row,
            employeeId: row.id,
            role: row.role || row.designation || '',
        }))
        setRows(mapped)
        setSource('backend')
    }, [])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setRows(EMPLOYEES_LIST)
            setSource('local')
            setLoading(false)
            return
        }
        loadLive()
    }, [loadLive])

    const filteredEmployees = useMemo(() => {
        const query = search.trim().toLowerCase()
        return rows.filter((employee) => {
            if (departmentFilter && employee.department !== departmentFilter) return false
            if (!query) return true
            const haystack = `${employee.employeeId || employee.id} ${employee.name} ${employee.department} ${employee.role} ${employee.email}`.toLowerCase()
            return haystack.includes(query)
        })
    }, [search, departmentFilter, rows])

    const departmentOptions = useMemo(() => {
        if (!live) return DEPARTMENTS
        const set = new Set(rows.map((row) => row.department).filter(Boolean))
        return [...set].sort()
    }, [live, rows])

    return (
        <section>
            {source === 'backend' ? (
            ) : null}
            {source === 'error' ? (
                <FeedbackState kind='error' title='Employees API unavailable' description={error} />
            ) : null}
            {loading ? (
                <FeedbackState kind='loading' title='Loading employees' description='Fetching from the HR portal API…' />
            ) : null}

            {!loading && source !== 'error' ? (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                            <button type='button' onClick={() => { setSearch(''); setDepartmentFilter('') }} className='bg-[#515DEF] text-white uppercase text-sm px-6 py-2 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'>Clear Filters</button>
                        </div>
                        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-base font-medium text-[#808080]'>Search</label>
                                <input type='text' value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Employee ID, name...' className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full' />
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-base font-medium text-[#808080]'>Department</label>
                                <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className='text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'>
                                    <option value=''>All</option>
                                    {departmentOptions.map((department) => (
                                        <option key={department} value={department}>{department}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                        <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                            <div>
                                <h2 className='text-xl font-medium text-black'>Employee List</h2>
                                <p className='text-sm text-[#667085] mt-1'>Showing {filteredEmployees.length} of {rows.length} employees</p>
                            </div>
                            <button type='button' onClick={() => setExportModal(true)} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'>
                                <Download size={16} />
                                Export
                            </button>
                        </div>
                        <div className='relative overflow-x-auto'>
                            <table className='w-full text-sm text-left'>
                                <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                                    <tr>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Profile</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Employee ID</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Name</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Department</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Role / Designation</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Email</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Status</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEmployees.length === 0 ? (
                                        <tr><td colSpan={8} className='px-2 py-8 text-center text-[#667085]'>No employees found.</td></tr>
                                    ) : filteredEmployees.map((employee) => (
                                        <tr key={employee.id || employee.employeeId} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7]'>
                                            <td className='px-2 py-3'><img src={mo_user} alt='' className='w-9 h-9 rounded-full object-cover' /></td>
                                            <td className='px-2 py-3'>{employee.employeeId || employee.id}</td>
                                            <td className='px-2 py-3 text-[#1E1E1E] font-medium'>{employee.name}</td>
                                            <td className='px-2 py-3'>{employee.department || '—'}</td>
                                            <td className='px-2 py-3'>{employee.role || employee.designation || '—'}</td>
                                            <td className='px-2 py-3'>{employee.email || '—'}</td>
                                            <td className='px-2 py-3'>{employee.status || '—'}</td>
                                            <td className='px-2 py-3'>
                                                <NavLink to={`${ROUTE_BASE}/view/${employee.id || employee.employeeId}`} className='text-[#515DEF] font-semibold hover:underline'>View</NavLink>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <SuperAdminExportModal
                        exportModal={exportModal}
                        setExportModal={setExportModal}
                        recordCount={filteredEmployees.length}
                        documentTitle='Super Admin · Employee directory'
                        getExportLines={() => filteredEmployees.map((employee) => (
                            `${employee.employeeCode || employee.code || employee.id || '—'} | ${employee.name || '—'} | ${employee.department || '—'} | ${employee.designation || employee.role || '—'} | ${employee.status || '—'}`
                        ))}
                    />
                </>
            ) : null}
        </section>
    )
}

export default EmployeesList
