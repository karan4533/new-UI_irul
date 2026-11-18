import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import mo_user from '../../../../assets/images/no-profile.png'
import { FeedbackState } from '../../../../Common/ui'
import { ROUTE_BASE, getEmployeeById } from './employeeDatabaseData'
import { isLiveApiEnabled } from '../../../../services/api/tokenStore'
import { getEmployee, listPortalEmployees } from '../../../../services/api/hrApiService'

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

const ViewEmployee = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [employee, setEmployee] = useState(() => (live ? null : getEmployeeById(id)))
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')

    const loadLive = useCallback(async () => {
        setLoading(true)
        setError('')
        const portal = await listPortalEmployees()
        if (portal.success) {
            const found = (portal.data || []).find((row) => String(row.id) === String(id))
            if (found) {
                setEmployee({ ...found, employeeId: found.id, role: found.role || found.designation })
                setLoading(false)
                return
            }
        }
        const typed = await getEmployee(id)
        setLoading(false)
        if (!typed.success) {
            setEmployee(null)
            setError(typeof typed.error === 'string' ? typed.error : 'Employee was not found on the server.')
            return
        }
        setEmployee({ ...typed.data, employeeId: typed.data.id, role: typed.data.designation })
    }, [id])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setEmployee(getEmployeeById(id))
            setLoading(false)
            return
        }
        loadLive()
    }, [id, loadLive])

    if (loading) {
        return (
            <section className='space-y-6'>
                <button type='button' onClick={() => navigate(ROUTE_BASE)} className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2'><ArrowLeft size={18} /> Back to list</button>
                <FeedbackState kind='loading' title='Loading employee' description={`Fetching ${id}…`} />
            </section>
        )
    }

    if (!employee) {
        return (
            <section className='space-y-6'>
                <button type='button' onClick={() => navigate(ROUTE_BASE)} className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer'>
                    <ArrowLeft size={18} />
                    Back to list
                </button>
                <div className='bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]'>{error || 'Employee not found.'}</div>
            </section>
        )
    }

    return (
        <section className='space-y-6'>
            <button type='button' onClick={() => navigate(ROUTE_BASE)} className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer'>
                <ArrowLeft size={18} />
                Back to list
            </button>
            {live ? <p className='text-xs font-medium text-[#027A48]'>Live employee · shared HR API</p> : null}

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex flex-col sm:flex-row sm:items-center gap-4'>
                    <img src={employee.profileImage || mo_user} alt='' className='w-20 h-20 rounded-full object-cover ring-2 ring-indigo-100' />
                    <div>
                        <h1 className='text-2xl font-semibold text-black'>{employee.name}</h1>
                        <p className='text-sm text-[#667085] mt-1'>
                            <span className='font-medium text-[#1E1E1E]'>Employee ID: {employee.employeeId || employee.id}</span>
                            {' · '}
                            <span className='text-[#808080]'>Department: {employee.department || '—'}</span>
                            {' · '}
                            <span className='text-[#808080]'>Role: {employee.role || employee.designation || '—'}</span>
                        </p>
                    </div>
                </div>
            </div>

            <Section title='Employment information'>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                    <Field label='Name' value={employee.name} />
                    <Field label='Employee ID' value={employee.employeeId || employee.id} />
                    <Field label='Department' value={employee.department} />
                    <Field label='Designation' value={employee.designation || employee.role} />
                    <Field label='Status' value={employee.status} />
                    <Field label='Joining date' value={employee.joiningDate} />
                    <Field label='Employment type' value={employee.employmentType} />
                    <Field label='Category' value={employee.category} />
                    <Field label='Email' value={employee.email} />
                    <Field label='Contact' value={employee.contact} />
                    <Field label='Reporting manager' value={employee.reportingManager} />
                    <Field label='Qualification' value={employee.qualification} />
                </div>
            </Section>
        </section>
    )
}

export default ViewEmployee
