import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTransportVehicles, upsertTransportDriverMaintenance } from '../../../services/api/transportApiService'

const inputClass = 'text-sm border border-[#D9D9D9] rounded-md px-2 py-3 w-full'

const AddMaintenanceRequest = () => {
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [saving, setSaving] = useState(false)
    const [vehicles, setVehicles] = useState([])
    const [form, setForm] = useState({
        vehicleNumber: '',
        issueType: 'General',
        priority: 'Medium',
        requestDate: '',
        approvalStatus: 'Pending',
        description: '',
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
        if (!form.vehicleNumber.trim() || !form.issueType.trim()) {
            toast.error('Vehicle number and issue type are required.')
            return
        }
        setSaving(true)
        const saved = await upsertTransportDriverMaintenance(form)
        setSaving(false)
        if (!saved.success) {
            toast.error(saved.error || 'Could not save maintenance request. Vehicle must be in your driver scope.')
            return
        }
        toast.success(`Maintenance ${saved.data?.maintenanceRequestId || saved.data?.id} saved on the server`)
        navigate('/driver/maintenance-request')
    }

    if (!live) return <FeedbackState kind='error' title='Live API required' description='Uses PUT /api/v1/ops/transport-driver-maintenance.' />

    return (
        <section className='space-y-6'>
            <IntegrationNotice
                state='connected'
                title='Live maintenance create'
                description='Vehicle options come from scoped transport-vehicles. Persist uses PUT transport-driver-maintenance. Out-of-scope plates are rejected (403).'
            />
            <div className='bg-white rounded-2xl shadow-md p-4 md:p-6'>
                <h2 className='text-xl font-semibold text-black'>Maintenance Request Information</h2>
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
                    <label className='text-sm'>Issue Type<input className={inputClass} value={form.issueType} onChange={onChange('issueType')} /></label>
                    <label className='text-sm'>Priority<select className={inputClass} value={form.priority} onChange={onChange('priority')}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
                    <label className='text-sm'>Request Date<input type='date' className={inputClass} value={form.requestDate} onChange={onChange('requestDate')} /></label>
                    <label className='text-sm md:col-span-3'>Description<textarea rows={3} className={inputClass} value={form.description} onChange={onChange('description')} /></label>
                </div>
            </div>
            <div className='flex sm:justify-end justify-center gap-x-4'>
                <button type='button' onClick={() => navigate('/driver/maintenance-request')} className='bg-white text-[#515DEF] text-sm px-12 py-2 rounded-md border border-[#515DEF]'>Discard Changes</button>
                <button type='button' disabled={saving} onClick={save} className='bg-[#515DEF] text-white text-sm px-12 py-2 rounded-md disabled:opacity-60'>{saving ? 'Saving…' : 'Submit Request'}</button>
            </div>
        </section>
    )
}

export default AddMaintenanceRequest
