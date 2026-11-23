import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar } from 'lucide-react'
import { toast } from 'react-toastify'
import { createFrontOfficeRecord } from '../../../services/api/frontOfficeApiService'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'

const emptyForm = () => ({
    studentName: '',
    transferType: 'Outward',
    transferTo: '',
    className: '',
    reason: '',
    status: 'Pending',
    admissionNumber: '',
})

const AddStudentTransfer = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const listPath = location.pathname.startsWith('/director')
        ? '/director/student-transfer'
        : location.pathname.startsWith('/admin')
            ? '/admin/student/student-transfer'
            : '/front-office/student-transfer'
    const [requestedOn, setRequestedOn] = useState(new Date())
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)

    const updateField = (key) => (event) => {
        setForm((prev) => ({ ...prev, [key]: event.target.value }))
    }

    const handleSave = async () => {
        if (!String(form.studentName || '').trim()) {
            toast.error('Student name is required.')
            return
        }
        if (!String(form.transferTo || '').trim()) {
            toast.error('Transfer destination is required.')
            return
        }

        const date = requestedOn instanceof Date && !Number.isNaN(requestedOn.getTime())
            ? requestedOn.toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10)

        const payload = {
            studentName: form.studentName.trim(),
            admissionNumber: String(form.admissionNumber || '').trim(),
            transferType: form.transferType || 'Outward',
            transferTo: form.transferTo.trim(),
            className: form.className.trim(),
            reason: form.reason.trim(),
            status: form.status || 'Pending',
            date,
            requestedOn: date,
        }

        if (!isLiveApiEnabled()) {
            toast.info('Saved locally (mock mode). Enable live API to persist transfers.')
            navigate(listPath)
            return
        }

        setSaving(true)
        const res = await createFrontOfficeRecord('student-transfers', payload)
        setSaving(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not save transfer.')
            return
        }
        toast.success('Student transfer saved.')
        navigate(listPath)
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>Student Transfer Information</h2>

                <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6 lg:mt-8 mt-2'>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Name:</label>
                        <input
                            type='text'
                            value={form.studentName}
                            onChange={updateField('studentName')}
                            className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Admission Number:</label>
                        <input
                            type='text'
                            value={form.admissionNumber}
                            onChange={updateField('admissionNumber')}
                            className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Transfer Type:</label>
                        <select
                            value={form.transferType}
                            onChange={updateField('transferType')}
                            className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                        >
                            <option value='Inward'>Inward</option>
                            <option value='Outward'>Outward</option>
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Transfer To:</label>
                        <input
                            type='text'
                            value={form.transferTo}
                            onChange={updateField('transferTo')}
                            className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Class:</label>
                        <input
                            type='text'
                            value={form.className}
                            onChange={updateField('className')}
                            placeholder='e.g. Grade 10 A'
                            className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Reason:</label>
                        <input
                            type='text'
                            value={form.reason}
                            onChange={updateField('reason')}
                            className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                        />
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>Requested On:</label>
                        <div className='relative'>
                            <DatePicker
                                selected={requestedOn}
                                onChange={setRequestedOn}
                                dateFormat='dd/MM/yyyy'
                                isClearable
                                className='w-full text-sm text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-3 py-3 pr-10 focus:outline-none'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#1E1E1E]'>MD Approval Status:</label>
                        <select
                            value={form.status}
                            onChange={updateField('status')}
                            className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                        >
                            <option value='Pending'>Pending</option>
                            <option value='Approved'>Approved</option>
                            <option value='Rejected'>Rejected</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={() => navigate(listPath)}
                    className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Discard Changes
                </button>
                <button
                    type='button'
                    disabled={saving}
                    onClick={handleSave}
                    className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-60'
                >
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
            </div>
        </section>
    )
}

export default AddStudentTransfer
