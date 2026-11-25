import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { FeedbackState, IntegrationNotice } from '../../../../Common/ui'
import { isLiveApiEnabled } from '../../../../services/api/tokenStore'
import { listTransportVehicles, upsertTransportVehicleHealth } from '../../../../services/api/transportApiService'

const inputClass = 'text-sm border border-[#D9D9D9] rounded-md px-2 py-3 w-full'

const AddVehicleHealthStatus = () => {
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [saving, setSaving] = useState(false)
    const [vehicles, setVehicles] = useState([])
    const [form, setForm] = useState({
        vehicleNumber: '',
        inspectionDate: '',
        engineStatus: 'Good',
        tyreCondition: 'Good',
        brakeCondition: 'Good',
        lightsStatus: 'Good',
        overallCondition: 'Good',
        remarks: '',
    })

    const onChange = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

    useEffect(() => {
        if (!live) return undefined
        let cancelled = false
        ;(async () => {
            const res = await listTransportVehicles()
            if (cancelled || !res.success) return
            const rows = Array.isArray(res.data) ? res.data : []
            setVehicles(rows)
            const first = rows[0]?.vehicleNumber || ''
            if (first) {
                setForm((prev) => (prev.vehicleNumber ? prev : { ...prev, vehicleNumber: first }))
            }
        })()
        return () => {
            cancelled = true
        }
    }, [live])

    const save = async () => {
        if (!form.vehicleNumber.trim()) {
            toast.error('Vehicle number is required.')
            return
        }
        setSaving(true)
        const saved = await upsertTransportVehicleHealth(form)
        setSaving(false)
        if (!saved.success) {
            toast.error(saved.error || 'Could not save health record. Ensure the vehicle is assigned to you.')
            return
        }
        toast.success(`Health record ${saved.data?.id} saved on the server`)
        navigate('/driver/vehicle-management/vehicle-health-status')
    }

    if (!live) {
        return <FeedbackState kind='error' title='Live API required' description='Uses PUT /api/v1/ops/transport-vehicle-health.' />
    }

    return (
        <section className='space-y-6'>
            <IntegrationNotice
                state='connected'
                title='Live vehicle health create'
                description='Vehicle options come from scoped transport-vehicles. Persist uses PUT transport-vehicle-health. Out-of-scope plates are rejected (403).'
            />
            <div className='bg-white rounded-2xl shadow-md p-4 md:p-6'>
                <h2 className='text-xl font-semibold text-black'>Vehicle Health Status Information</h2>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mt-6'>
                    <label className='text-sm'>Vehicle Number
                        {vehicles.length ? (
                            <select className={inputClass} value={form.vehicleNumber} onChange={onChange('vehicleNumber')}>
                                {vehicles.map((v) => (
                                    <option key={v.id || v.vehicleNumber} value={v.vehicleNumber}>{v.vehicleNumber}</option>
                                ))}
                            </select>
                        ) : (
                            <input className={inputClass} value={form.vehicleNumber} onChange={onChange('vehicleNumber')} placeholder='No scoped vehicle — ask TM to assign' />
                        )}
                    </label>
                    <label className='text-sm'>Inspection Date<input type='date' className={inputClass} value={form.inspectionDate} onChange={onChange('inspectionDate')} /></label>
                    {['engineStatus', 'tyreCondition', 'brakeCondition', 'lightsStatus', 'overallCondition'].map((key) => (
                        <label key={key} className='text-sm capitalize'>
                            {key.replace(/([A-Z])/g, ' $1')}
                            <select className={inputClass} value={form[key]} onChange={onChange(key)}>
                                <option>Good</option>
                                <option>Fair</option>
                                <option>Poor</option>
                            </select>
                        </label>
                    ))}
                    <label className='text-sm md:col-span-3'>Remarks<textarea className={inputClass} rows={3} value={form.remarks} onChange={onChange('remarks')} /></label>
                </div>
            </div>
            <div className='flex sm:justify-end justify-center gap-x-4'>
                <button type='button' onClick={() => navigate('/driver/vehicle-management/vehicle-health-status')} className='bg-white text-[#515DEF] text-sm px-12 py-2 rounded-md border border-[#515DEF]'>
                    Discard Changes
                </button>
                <button type='button' disabled={saving} onClick={save} className='bg-[#515DEF] text-white text-sm px-12 py-2 rounded-md disabled:opacity-60'>
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
            </div>
        </section>
    )
}

export default AddVehicleHealthStatus
