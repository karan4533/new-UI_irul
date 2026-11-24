import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar } from 'lucide-react'
import { toast } from 'react-toastify'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { upsertGateDuty } from '../../../services/api/gateApiService'

const formatDutyDate = (date) => {
    if (!date) return ''
    const d = String(date.getDate()).padStart(2, '0')
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const y = date.getFullYear()
    return `${d}-${m}-${y}`
}

const AssignDuty = () => {
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [dutyDate, setDutyDate] = useState(new Date())
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        dutyId: '',
        gateKeeperName: '',
        employeeId: '',
        assigneeEmail: 'gatekeeper@qmis.edu',
        gateLocation: '',
        shift: 'Morning',
        startTime: '',
        endTime: '',
        assignedBy: 'Gate Keeper Manager',
        status: 'Pending',
    })

    const onChange = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

    const save = async () => {
        if (!live) return
        if (!form.gateKeeperName.trim() || !form.gateLocation.trim()) {
            toast.error('Gate Keeper name and gate location are required.')
            return
        }
        setSaving(true)
        const saved = await upsertGateDuty({
            ...form,
            dutyDate: formatDutyDate(dutyDate),
            id: form.dutyId || undefined,
            dutyId: form.dutyId || undefined,
        })
        setSaving(false)
        if (!saved.success) {
            toast.error(saved.error || 'Could not save duty on the server.')
            return
        }
        toast.success(`Duty ${saved.data?.dutyId || saved.data?.id} saved on the server`)
        navigate('/gatekeeper-manager/assign-duty-list')
    }

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Assign Duty uses PUT /api/v1/ops/gate-duties.'
            />
        )
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>Assign Duty Information</h2>
                <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Duty ID:</label>
                        <input value={form.dutyId} onChange={onChange('dutyId')} placeholder='Leave blank to auto-generate' type='text' className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Gate Keeper Name:</label>
                        <input value={form.gateKeeperName} onChange={onChange('gateKeeperName')} type='text' className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Employee ID:</label>
                        <input value={form.employeeId} onChange={onChange('employeeId')} type='text' className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Assignee email (for My Duty filter):</label>
                        <input value={form.assigneeEmail} onChange={onChange('assigneeEmail')} type='email' placeholder='gatekeeper@qmis.edu' className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Gate Location:</label>
                        <input value={form.gateLocation} onChange={onChange('gateLocation')} type='text' className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Shift:</label>
                        <select value={form.shift} onChange={onChange('shift')} className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'>
                            <option value='Morning'>Morning</option>
                            <option value='Afternoon'>Afternoon</option>
                            <option value='Evening'>Evening</option>
                            <option value='Night'>Night</option>
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Duty Date:</label>
                        <div className='relative'>
                            <DatePicker
                                selected={dutyDate}
                                onChange={(date) => setDutyDate(date)}
                                dateFormat='dd/MM/yyyy'
                                isClearable
                                className='w-full text-sm text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-3 py-3 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Start Time:</label>
                        <input value={form.startTime} onChange={onChange('startTime')} type='time' className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>End Time:</label>
                        <input value={form.endTime} onChange={onChange('endTime')} type='time' className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full' />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Assigned By:</label>
                        <select value={form.assignedBy} onChange={onChange('assignedBy')} className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'>
                            <option value='Gate Keeper Manager'>Gate Keeper Manager</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={() => navigate('/gatekeeper-manager/assign-duty-list')}
                    className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Discard Changes
                </button>
                <button
                    type='button'
                    disabled={saving}
                    onClick={save}
                    className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-60'
                >
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
            </div>
        </section>
    )
}

export default AssignDuty
