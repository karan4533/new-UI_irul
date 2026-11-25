import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { getIncidentSlaHours } from '../../../Common/operations/incidentState'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { upsertGateIncident } from '../../../services/api/gateApiService'

const inputClass = 'text-sm text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
const today = () => {
    const now = new Date()
    const offset = now.getTimezoneOffset() * 60 * 1000
    return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const AddIncidents = () => {
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [date, setDate] = useState(today)
    const [priority, setPriority] = useState('High')
    const [saving, setSaving] = useState(false)

    const save = async (event) => {
        event.preventDefault()
        if (!live) return
        const data = new FormData(event.currentTarget)
        setSaving(true)
        const payload = {
            id: String(data.get('reportId') || '').trim() || undefined,
            incidentType: data.get('incidentType'),
            date,
            time: data.get('time'),
            location: data.get('location'),
            description: data.get('description'),
            assignedTo: data.get('reportTo'),
            priority,
            reportedBy: 'CSO / Gate Keeper',
            status: 'Open',
        }
        const saved = await upsertGateIncident(payload)
        setSaving(false)
        if (!saved.success) {
            toast.error(saved.error || 'Could not save incident on the server.')
            return
        }
        toast.success(`Incident ${saved.data?.id} saved on the server`)
        navigate(`/gate-keeper/incidents/${saved.data?.id || ''}`)
    }

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Add Incident uses PUT /api/v1/ops/gate-incidents.'
            />
        )
    }

    return (
        <form onSubmit={save}>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>CSO / Gate Keeper — Add Incident</h2>
                <p className='mt-1 text-sm text-[var(--erp-slate)]'>
                    Record the event immediately. Critical and high-priority incidents enter the shortest manager response windows.
                </p>
                <IntegrationNotice
                    state='connected'
                    className='mt-4'
                    title='Persists on campus ops'
                    description='Submit writes the incident into /api/v1/ops/gate-incidents. Browser demoDomain is not used.'
                />
                <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mt-6'>
                    <label className='text-sm'>Report ID<input name='reportId' className={inputClass} placeholder='Leave blank to generate' /></label>
                    <label className='text-sm'>Incident Type<input name='incidentType' required className={inputClass} /></label>
                    <label className='text-sm'>Date<input type='date' value={date} onChange={(event) => setDate(event.target.value)} required className={inputClass} /></label>
                    <label className='text-sm'>Time<input name='time' type='time' required className={inputClass} /></label>
                    <label className='text-sm'>Location<input name='location' required placeholder='Gate, block, or area' className={inputClass} /></label>
                    <label className='text-sm'>
                        Priority
                        <select name='priority' value={priority} onChange={(event) => setPriority(event.target.value)} className={inputClass}>
                            <option>Critical</option>
                            <option>High</option>
                            <option>Medium</option>
                            <option>Low</option>
                        </select>
                        <span className='mt-1 block text-xs text-[var(--erp-muted)]'>{getIncidentSlaHours(priority)} hour response target</span>
                    </label>
                    <label className='text-sm md:col-span-3'>Description<textarea name='description' required rows={3} className={inputClass} /></label>
                    <label className='text-sm'>
                        Assign To
                        <select name='reportTo' className={inputClass}>
                            <option>Gate Keeper Manager</option>
                            <option>Admin</option>
                            <option>Security</option>
                        </select>
                    </label>
                </div>
            </div>
            <div className='flex justify-end gap-4 mt-6'>
                <button type='button' onClick={() => navigate('/gate-keeper/incidents')} className='min-h-10 rounded-lg border border-[var(--erp-indigo)] px-6 text-sm font-semibold text-[var(--erp-indigo)]'>
                    Cancel
                </button>
                <button type='submit' disabled={saving} className='min-h-10 rounded-lg bg-[var(--erp-indigo)] px-6 text-sm font-semibold text-white disabled:opacity-60'>
                    {saving ? 'Saving…' : 'Submit incident'}
                </button>
            </div>
        </form>
    )
}

export default AddIncidents
