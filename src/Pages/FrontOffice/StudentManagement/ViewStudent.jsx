import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import mo_user from '../../../assets/images/no-profile.png'
import { FeedbackState } from '../../../Common/ui'
import { ROUTE_BASE, getStudentById } from './studentDatabaseData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { getStudent } from '../../../services/api/studentApiService'

const Section = ({ title, children }) => (
    <div className='bg-white rounded-2xl shadow-md p-4'>
        <h2 className='text-xl font-semibold text-black mb-6'>{title}</h2>
        {children}
    </div>
)

const Field = ({ label, value }) => (
    <div className='flex flex-col gap-y-1'>
        <span className='text-base font-medium text-[#808080]'>{label}</span>
        <span className='text-sm text-[#1E1E1E] whitespace-pre-wrap wrap-break-word'>{value || '—'}</span>
    </div>
)

const ViewStudent = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [student, setStudent] = useState(() => (live ? null : getStudentById(id)))
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')

    const loadLive = useCallback(async () => {
        setLoading(true)
        setError('')
        const res = await getStudent(id)
        setLoading(false)
        if (!res.success) {
            setStudent(null)
            setError(typeof res.error === 'string' ? res.error : 'Student was not found on the server.')
            return
        }
        setStudent(res.data)
    }, [id])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setStudent(getStudentById(id))
            setLoading(false)
            return
        }
        loadLive()
    }, [id, loadLive])

    if (loading) {
        return (
            <section className='space-y-6'>
                <button type='button' onClick={() => navigate(ROUTE_BASE)} className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2'><ArrowLeft size={18} /> Back to list</button>
                <FeedbackState kind='loading' title='Loading student' description={`Fetching ${id}…`} />
            </section>
        )
    }

    if (!student) {
        return (
            <section className='space-y-6'>
                <button type='button' onClick={() => navigate(ROUTE_BASE)} className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer'>
                    <ArrowLeft size={18} />
                    Back to list
                </button>
                <div className='bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]'>{error || 'Student not found.'}</div>
            </section>
        )
    }

    const displayName = student.name
        || [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ')

    return (
        <section className='space-y-6'>
            <button type='button' onClick={() => navigate(ROUTE_BASE)} className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer'>
                <ArrowLeft size={18} />
                Back to list
            </button>

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex flex-col sm:flex-row sm:items-center gap-4'>
                    <img src={student.profileImage || mo_user} alt='' className='w-20 h-20 rounded-full object-cover ring-2 ring-indigo-100' />
                    <div className='flex-1'>
                        <h1 className='text-2xl font-semibold text-black'>{displayName}</h1>
                        <p className='text-sm text-[#667085] mt-1'>
                            <span className='font-medium text-[#1E1E1E]'>Admission No: {student.admissionNumber || '—'}</span>
                        </p>
                    </div>
                </div>
            </div>

            <Section title='Placement details'>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                    <Field label='Class' value={student.className || student.class} />
                    <Field label='Section' value={student.section} />
                    <Field label='Class section' value={student.classSection} />
                    <Field label='Roll number' value={student.rollNumber} />
                    <Field label='Placement status' value={student.placementStatus} />
                    <Field label='Status' value={student.status} />
                    <Field label='Student ID' value={student.id || student.studentId} />
                </div>
            </Section>

            <Section title='Student information'>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                    <Field label='Name' value={displayName} />
                    <Field label='Gender' value={student.gender} />
                    <Field label='Email' value={student.email} />
                    <Field label='Mobile' value={student.mobileNumber} />
                    <Field label='Date of birth' value={student.dateOfBirth} />
                    <Field label='Country' value={student.country} />
                    <Field label='State' value={student.state} />
                    <Field label='City' value={student.city} />
                </div>
            </Section>
        </section>
    )
}

export default ViewStudent
