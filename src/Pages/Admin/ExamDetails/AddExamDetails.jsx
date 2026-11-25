import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar } from 'lucide-react'
import { toast } from 'react-toastify'
import { createExam } from '../../../services/api/examsApiService'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    CLASS_OPTIONS,
    SUBJECT_OPTIONS,
    ROOM_OPTIONS,
    INVIGILATOR_OPTIONS,
    addExamDetail,
} from './examDetailsData'

const toIsoDate = (value) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ''
    return value.toISOString().slice(0, 10)
}

const AddExamDetails = () => {
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [examName, setExamName] = useState('')
    const [className, setClassName] = useState(CLASS_OPTIONS[0])
    const [subject, setSubject] = useState(SUBJECT_OPTIONS[0])
    const [examType, setExamType] = useState('MIDTERM')
    const [examDate, setExamDate] = useState(new Date())
    const [endDate, setEndDate] = useState(new Date())
    const [startTime, setStartTime] = useState('09:00')
    const [endTime, setEndTime] = useState('12:00')
    const [room, setRoom] = useState(ROOM_OPTIONS[0])
    const [invigilator, setInvigilator] = useState(INVIGILATOR_OPTIONS[0])
    const [saving, setSaving] = useState(false)

    const handleSave = async (e) => {
        e.preventDefault()
        if (!examName.trim()) {
            toast.error('Exam name is required.')
            return
        }

        if (live) {
            setSaving(true)
            const res = await createExam({
                examName: examName.trim(),
                name: `${examName.trim()}${subject ? ` · ${subject}` : ''}`,
                className,
                examType,
                startDateIso: toIsoDate(examDate),
                endDateIso: toIsoDate(endDate) || toIsoDate(examDate),
            })
            setSaving(false)
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Could not create exam.')
                return
            }
            toast.success('Exam created on the campus exams API.')
            navigate('/admin/exam-details/exam-details-list')
            return
        }

        const dateStr = examDate ? examDate.toLocaleDateString('en-GB').replace(/\//g, '-') : ''
        try {
            addExamDetail({
                examName: examName.trim(),
                className,
                section: 'A',
                subject,
                examDate: dateStr,
                startTime: startTime ? `${startTime}` : '09:00 AM',
                endTime: endTime ? `${endTime}` : '12:00 PM',
                room,
                invigilator,
            })
            toast.success('Exam details saved locally (mock mode).')
            navigate('/admin/exam-details/exam-details-list')
        } catch (err) {
            toast.error('Failed to save exam details: ' + err.message)
        }
    }

    return (
        <section>
            <form onSubmit={handleSave}>
                <div className='bg-white rounded-2xl shadow-md p-4'>
                    <h2 className='text-xl font-semibold text-black'>Exam Details Information</h2>
                    {live ? (
                        <p className='text-sm text-[#667085] mt-1'>Creates a campus exam via POST /api/v1/exams.</p>
                    ) : null}

                    <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6 lg:mt-8 mt-2'>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='exam-name' className='text-base font-medium text-[#1E1E1E]'>Exam Name:</label>
                            <input
                                id='exam-name'
                                type='text'
                                value={examName}
                                onChange={(e) => setExamName(e.target.value)}
                                placeholder='e.g. Mid Term Assessment'
                                required
                                className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'
                            />
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='class-select' className='text-base font-medium text-[#1E1E1E]'>Class:</label>
                            <select
                                id='class-select'
                                value={className}
                                onChange={(e) => setClassName(e.target.value)}
                                className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full bg-white'
                            >
                                {CLASS_OPTIONS.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='subject-select' className='text-base font-medium text-[#1E1E1E]'>Subject:</label>
                            <select
                                id='subject-select'
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full bg-white'
                            >
                                {SUBJECT_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        {live ? (
                            <div className='flex flex-col gap-y-2'>
                                <label htmlFor='exam-type' className='text-base font-medium text-[#1E1E1E]'>Exam type:</label>
                                <select
                                    id='exam-type'
                                    value={examType}
                                    onChange={(e) => setExamType(e.target.value)}
                                    className='text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full bg-white'
                                >
                                    <option value='MIDTERM'>Midterm</option>
                                    <option value='FINAL'>Final</option>
                                    <option value='UNIT'>Unit</option>
                                    <option value='PRACTICAL'>Practical</option>
                                </select>
                            </div>
                        ) : null}
                        <div className='flex flex-col gap-y-2'>
                            <label className='text-base font-medium text-[#1E1E1E]'>{live ? 'Start date:' : 'Exam Date:'}</label>
                            <div className='relative'>
                                <DatePicker
                                    selected={examDate}
                                    onChange={setExamDate}
                                    dateFormat='dd/MM/yyyy'
                                    className='w-full text-sm text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-3 py-3 pr-10 focus:outline-none'
                                />
                                <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                            </div>
                        </div>
                        {live ? (
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-base font-medium text-[#1E1E1E]'>End date:</label>
                                <div className='relative'>
                                    <DatePicker
                                        selected={endDate}
                                        onChange={setEndDate}
                                        dateFormat='dd/MM/yyyy'
                                        className='w-full text-sm text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-3 py-3 pr-10 focus:outline-none'
                                    />
                                    <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className='flex flex-col gap-y-2'>
                                    <label className='text-base font-medium text-[#1E1E1E]'>Start time:</label>
                                    <input type='time' value={startTime} onChange={(e) => setStartTime(e.target.value)} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-3 w-full' />
                                </div>
                                <div className='flex flex-col gap-y-2'>
                                    <label className='text-base font-medium text-[#1E1E1E]'>End time:</label>
                                    <input type='time' value={endTime} onChange={(e) => setEndTime(e.target.value)} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-3 w-full' />
                                </div>
                                <div className='flex flex-col gap-y-2'>
                                    <label className='text-base font-medium text-[#1E1E1E]'>Room:</label>
                                    <select value={room} onChange={(e) => setRoom(e.target.value)} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-3 w-full bg-white'>
                                        {ROOM_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div className='flex flex-col gap-y-2'>
                                    <label className='text-base font-medium text-[#1E1E1E]'>Invigilator:</label>
                                    <select value={invigilator} onChange={(e) => setInvigilator(e.target.value)} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-3 w-full bg-white'>
                                        {INVIGILATOR_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                    <button
                        type='button'
                        onClick={() => navigate('/admin/exam-details/exam-details-list')}
                        className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white transition-all duration-200 cursor-pointer md:w-auto w-full'
                    >
                        Discard Changes
                    </button>
                    <button
                        type='submit'
                        disabled={saving}
                        className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-60'
                    >
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </section>
    )
}

export default AddExamDetails
