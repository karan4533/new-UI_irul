import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ExamScheduleForm from './Components/ExamScheduleForm'
import { FeedbackState } from '../../../Common/ui'
import { addExamSchedule } from './createExamScheduleData'

const AddExamSchedule = () => {
    const navigate = useNavigate()
    const [error, setError] = useState('')

    const handleSave = async (values) => {
        setError('')
        const result = await addExamSchedule(values)
        if (result && result.success === false) {
            setError(typeof result.error === 'string' ? result.error : 'Could not create exam schedule.')
            return
        }
        navigate('/teacher/examination/create-schedule')
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>Create Exam Schedule Information</h2>
                {error ? <FeedbackState compact kind='error' title='Exam schedule not saved' description={error} className='mt-4' /> : null}
                <ExamScheduleForm onSubmit={handleSave} />
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={() => navigate('/teacher/examination/create-schedule')}
                    className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white hover:border-[#515DEF] transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Discard Changes
                </button>
                <button
                    type='submit'
                    form='exam-schedule-form'
                    className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Save Changes
                </button>
            </div>
        </section>
    )
}

export default AddExamSchedule
