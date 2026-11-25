import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar } from 'lucide-react'
import { IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { upsertTransportMaintenance } from '../../../services/api/transportApiService'
import {
    VEHICLE_OPTIONS,
    VEHICLE_TYPES,
    SERVICE_TYPES,
    SERVICE_CENTERS,
    MAINTENANCE_STATUSES,
} from './vehicleMaintenanceData'

const selectClass =
    'text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full bg-white'
const inputClass =
    'text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'

const formatDisplayDate = (value) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ''
    const dd = String(value.getDate()).padStart(2, '0')
    const mm = String(value.getMonth() + 1).padStart(2, '0')
    const yyyy = value.getFullYear()
    return `${dd}-${mm}-${yyyy}`
}

const AddVehicleMaintenance = () => {
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        vehicleNumber: '',
        vehicleType: '',
        serviceType: '',
        serviceCenter: '',
        estimatedCost: '',
        status: 'Scheduled',
    })
    const [lastServiceDate, setLastServiceDate] = useState(new Date())
    const [nextServiceDate, setNextServiceDate] = useState(new Date())

    const handleVehicleChange = (e) => {
        const selected = VEHICLE_OPTIONS.find((vehicle) => vehicle.label === e.target.value)
        setForm((prev) => ({
            ...prev,
            vehicleNumber: e.target.value,
            vehicleType: selected?.vehicleType || prev.vehicleType,
        }))
    }

    const handleSave = async () => {
        if (!form.vehicleNumber.trim() || !form.serviceType.trim()) {
            toast.error('Vehicle number and service type are required.')
            return
        }
        if (!live) {
            toast.success('Vehicle maintenance record saved locally (demo).')
            navigate('/transport-manager/vehicle-maintenance')
            return
        }
        setSaving(true)
        const res = await upsertTransportMaintenance({
            ...form,
            lastServiceDate: formatDisplayDate(lastServiceDate),
            nextServiceDate: formatDisplayDate(nextServiceDate),
            estimatedCost: form.estimatedCost,
        })
        setSaving(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not save maintenance.')
            return
        }
        toast.success('Maintenance saved on the server.')
        navigate('/transport-manager/vehicle-maintenance')
    }

    return (
        <section>
            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live maintenance create'
                    description='Persists via PUT /api/v1/ops/transport-maintenance after server confirmation.'
                    className='mb-4'
                />
            ) : (
                <IntegrationNotice
                    state='mock'
                    title='Demo maintenance create'
                    description='Enable live API to persist maintenance on FastAPI ops.'
                    className='mb-4'
                />
            )}
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>Vehicle Maintenance Information</h2>
                <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='vehicle-number' className='text-base font-medium text-[#1E1E1E]'>Vehicle Number:</label>
                        <select id='vehicle-number' value={form.vehicleNumber} onChange={handleVehicleChange} className={selectClass}>
                            <option value=''>--Select--</option>
                            {VEHICLE_OPTIONS.map((vehicle) => (
                                <option key={vehicle.id} value={vehicle.label}>{vehicle.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='vehicle-type' className='text-base font-medium text-[#1E1E1E]'>Vehicle Type:</label>
                        <select
                            id='vehicle-type'
                            value={form.vehicleType}
                            onChange={(e) => setForm((prev) => ({ ...prev, vehicleType: e.target.value }))}
                            className={selectClass}
                        >
                            <option value=''>--Select--</option>
                            {VEHICLE_TYPES.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Last Service Date:</label>
                        <div className='relative'>
                            <DatePicker
                                selected={lastServiceDate}
                                onChange={(date) => setLastServiceDate(date)}
                                dateFormat='dd/MM/yyyy'
                                isClearable
                                className='w-full text-sm text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-3 py-3 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Next Service Date:</label>
                        <div className='relative'>
                            <DatePicker
                                selected={nextServiceDate}
                                onChange={(date) => setNextServiceDate(date)}
                                dateFormat='dd/MM/yyyy'
                                isClearable
                                className='w-full text-sm text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-3 py-3 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='service-type' className='text-base font-medium text-[#1E1E1E]'>Service Type:</label>
                        <select
                            id='service-type'
                            value={form.serviceType}
                            onChange={(e) => setForm((prev) => ({ ...prev, serviceType: e.target.value }))}
                            className={selectClass}
                        >
                            <option value=''>--Select--</option>
                            {SERVICE_TYPES.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='service-center' className='text-base font-medium text-[#1E1E1E]'>Service Center:</label>
                        <select
                            id='service-center'
                            value={form.serviceCenter}
                            onChange={(e) => setForm((prev) => ({ ...prev, serviceCenter: e.target.value }))}
                            className={selectClass}
                        >
                            <option value=''>--Select--</option>
                            {SERVICE_CENTERS.map((center) => (
                                <option key={center} value={center}>{center}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='estimated-cost' className='text-base font-medium text-[#1E1E1E]'>Estimated Cost:</label>
                        <input
                            id='estimated-cost'
                            value={form.estimatedCost}
                            onChange={(e) => setForm((prev) => ({ ...prev, estimatedCost: e.target.value }))}
                            className={inputClass}
                            placeholder='₹0'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='status' className='text-base font-medium text-[#1E1E1E]'>Status:</label>
                        <select
                            id='status'
                            value={form.status}
                            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                            className={selectClass}
                        >
                            {MAINTENANCE_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={() => navigate('/transport-manager/vehicle-maintenance')}
                    className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white hover:border-[#515DEF] transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Discard Changes
                </button>
                <button
                    type='button'
                    disabled={saving}
                    onClick={handleSave}
                    className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-50'
                >
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
            </div>
        </section>
    )
}

export default AddVehicleMaintenance
