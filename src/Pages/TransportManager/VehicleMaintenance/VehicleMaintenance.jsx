import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar, EllipsisIcon, ChevronLeft, ChevronRight, Plus, Download } from 'lucide-react'
import Dropdown from '../../../Common/CommonComponents/Dropdown'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import EditRequestModal from '../../../Common/CommonComponents/EditRequestModal'
import DeleteRequestModal from '../../../Common/CommonComponents/DeleteRequestModal'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTransportMaintenance } from '../../../services/api/transportApiService'
import {
    MAINTENANCE_RECORDS,
    MAINTENANCE_STATUSES,
    SERVICE_TYPES,
    VEHICLE_TYPES,
    statusBadgeColor,
} from './vehicleMaintenanceData'

const VehicleMaintenance = () => {
    const live = isLiveApiEnabled()
    const [fromDate, setFromDate] = useState(new Date())
    const [toDate, setToDate] = useState(new Date())
    const [exportModal, setExportModal] = useState(false)
    const [editRequestModal, setEditRequestModal] = useState(false)
    const [deleteRequestModal, setDeleteRequestModal] = useState(false)
    const [records, setRecords] = useState(() => (live ? [] : MAINTENANCE_RECORDS))
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [vehicleTypeFilter, setVehicleTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [serviceTypeFilter, setServiceTypeFilter] = useState('')

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setRecords(MAINTENANCE_RECORDS)
            setLoading(false)
            setError('')
            return
        }
        setLoading(true)
        setError('')
        const res = await listTransportMaintenance()
        setLoading(false)
        if (!res.success) {
            setError(typeof res.error === 'string' ? res.error : 'Failed to load transport-maintenance.')
            setRecords([])
            return
        }
        setRecords(Array.isArray(res.data) ? res.data : [])
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        return records.filter((row) => {
            if (vehicleTypeFilter && String(row.vehicleType || '') !== vehicleTypeFilter) return false
            if (statusFilter && String(row.status || '') !== statusFilter) return false
            if (serviceTypeFilter && String(row.serviceType || '') !== serviceTypeFilter) return false
            if (!q) return true
            return `${row.serviceId} ${row.vehicleNumber} ${row.serviceCenter} ${row.serviceType}`.toLowerCase().includes(q)
        })
    }, [records, search, vehicleTypeFilter, statusFilter, serviceTypeFilter])

    const handleClearFilters = () => {
        setSearch('')
        setVehicleTypeFilter('')
        setStatusFilter('')
        setServiceTypeFilter('')
        setFromDate(new Date())
        setToDate(new Date())
    }

    return (
        <section className='space-y-4'>
            {live && !error && !loading ? (
                <IntegrationNotice
                    state='connected'
                    title='Vehicle maintenance is live'
                    description='GET/PUT /api/v1/ops/transport-maintenance. Add persists via upsert. GPS tracking remains DEMO elsewhere.'
                />
            ) : null}
            {!live ? (
                <IntegrationNotice
                    state='mock'
                    title='Vehicle maintenance list is browser mock'
                    description='Enable live API to use /api/v1/ops/transport-maintenance.'
                />
            ) : null}
            {error ? (
                <>
                    <IntegrationNotice state='failed' title='Maintenance API failed' description={error} />
                    <FeedbackState kind='error' title='Maintenance API unavailable' description={error} />
                </>
            ) : null}

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex justify-between md:items-center sm:items-stretch md:flex-row sm:flex-col flex-col gap-y-4'>
                    <button
                        type='button'
                        onClick={handleClearFilters}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-1.5 border border-[#515DEF] rounded-lg hover:opacity-90 transition-all duration-200 cursor-pointer'
                    >
                        Clear Filters
                    </button>
                    <select className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full md:max-w-xs sm:max-w-full'>
                        <option value=''>From Beginning</option>
                    </select>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='search' className='text-base font-medium text-[#808080]'>Search</label>
                        <input
                            type='text'
                            id='search'
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder='Service ID, vehicle, center...'
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='vehicle-type-filter' className='text-base font-medium text-[#808080]'>Vehicle Type</label>
                        <select
                            id='vehicle-type-filter'
                            value={vehicleTypeFilter}
                            onChange={(e) => setVehicleTypeFilter(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {VEHICLE_TYPES.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='status-filter' className='text-base font-medium text-[#808080]'>Status</label>
                        <select
                            id='status-filter'
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {MAINTENANCE_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='service-type-filter' className='text-base font-medium text-[#808080]'>Service Type</label>
                        <select
                            id='service-type-filter'
                            value={serviceTypeFilter}
                            onChange={(e) => setServiceTypeFilter(e.target.value)}
                            className='text-sm font-normal text-[#808080] border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
                        >
                            <option value=''>All</option>
                            {SERVICE_TYPES.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>From</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={fromDate}
                                onChange={(date) => setFromDate(date)}
                                isClearable
                                showMonthYearDropdown
                                scrollableMonthYearDropdown
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
                                showMonthYearDropdown
                                scrollableMonthYearDropdown
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                </div>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
                    <h2 className='text-xl font-medium text-black'>Vehicle Maintenance</h2>
                    <div className='flex gap-x-2'>
                        <NavLink
                            to='/transport-manager/vehicle-maintenance/add'
                            className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                        >
                            <Plus size={16} />
                            Add Maintenance
                        </NavLink>
                        <button
                            type='button'
                            onClick={() => setExportModal(true)}
                            className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                        >
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                </div>
                {loading ? <FeedbackState kind='loading' title='Loading maintenance' description='Fetching transport-maintenance…' /> : null}
                <div className='flex gap-x-2 items-center my-2'>
                    <select className='px-2 py-1.5 bg-white text-[#515DEF] border border-[#515DEF] rounded-md'>
                        <option value='10'>10</option>
                        <option value='20'>20</option>
                        <option value='30'>30</option>
                        <option value='40'>40</option>
                        <option value='50'>50</option>
                    </select>
                    <span className='text-sm font-normal text-[#515DEF]'>Entries Per Page</span>
                </div>
                <div className='relative overflow-x-auto'>
                    <table className='w-full text-sm text-left rtl:text-right'>
                        <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                            <tr className='rounded-lg'>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>Service ID</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Vehicle Number</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Vehicle Type</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Last Service Date</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Next Service Date</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Service Type</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Service Center</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Estimated Cost</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Status</th>
                                <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className='px-2 py-8 text-center text-sm text-[#667085]'>
                                        {live ? 'No maintenance rows on the server yet.' : 'No maintenance records.'}
                                    </td>
                                </tr>
                            ) : null}
                            {filtered.map((record) => (
                                <tr key={record.id} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7] rounded-lg'>
                                    <td className='px-2 py-4 font-medium text-[#1E1E1E] rounded-s-lg'>{record.serviceId}</td>
                                    <td className='px-2 py-4 font-medium text-[#1E1E1E]'>{record.vehicleNumber}</td>
                                    <td className='px-2 py-4'>{record.vehicleType}</td>
                                    <td className='px-2 py-4'>{record.lastServiceDate}</td>
                                    <td className='px-2 py-4'>{record.nextServiceDate}</td>
                                    <td className='px-2 py-4'>{record.serviceType}</td>
                                    <td className='px-2 py-4'>{record.serviceCenter}</td>
                                    <td className='px-2 py-4'>{record.estimatedCost}</td>
                                    <td className='px-2 py-4'>
                                        <span className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${statusBadgeColor[record.status] || 'bg-slate-100 text-slate-700'}`}>
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className='px-2 py-4 text-center rounded-e-lg'>
                                        <Dropdown buttonContent={<EllipsisIcon size={16} className='text-black' />}>
                                            <NavLink
                                                to={`/transport-manager/vehicle-maintenance/view/${record.id}`}
                                                className='block w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'
                                            >
                                                View
                                            </NavLink>
                                            <button
                                                type='button'
                                                onClick={() => setEditRequestModal(true)}
                                                className='w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type='button'
                                                onClick={() => setDeleteRequestModal(true)}
                                                className='w-full text-left p-2 hover:bg-[#515DEF] hover:text-white rounded cursor-pointer'
                                            >
                                                Delete
                                            </button>
                                        </Dropdown>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className='flex justify-between items-center px-4 mt-4'>
                <p className='text-sm font-medium text-[#515DEF]'>
                    Showing {filtered.length ? 1 : 0} to {filtered.length} of {filtered.length} entries
                </p>
                <div className='flex justify-center gap-x-2 flex-wrap'>
                    <button type='button' className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer'>
                        <ChevronLeft size={16} />
                    </button>
                    <button type='button' className='size-8 flex justify-center items-center p-2 bg-[#515DEF] text-white border border-[#515DEF] rounded-full cursor-pointer'>
                        1
                    </button>
                    <button type='button' className='size-8 flex justify-center items-center p-2 bg-white text-[#515DEF] border border-[#E2E8F0] hover:bg-[#515DEF] hover:text-white rounded-full cursor-pointer'>
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <ExportModal exportModal={exportModal} setExportModal={setExportModal} />
            <EditRequestModal editRequestModal={editRequestModal} setEditRequestModal={setEditRequestModal} />
            <DeleteRequestModal deleteRequestModal={deleteRequestModal} setDeleteRequestModal={setDeleteRequestModal} />
        </section>
    )
}

export default VehicleMaintenance
