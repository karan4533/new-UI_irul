import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listHostelAssignments, listHostelPayments } from '../../../services/api/hostelApiService'

const Dashboard = () => {
    const live = isLiveApiEnabled()
    const [assignments, setAssignments] = useState([])
    const [payments, setPayments] = useState([])
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setLoading(false)
            return
        }
        setLoading(true)
        setError('')
        const [a, p] = await Promise.all([listHostelAssignments(), listHostelPayments()])
        setLoading(false)
        if (!a.success || !p.success) {
            setError(
                typeof a.error === 'string'
                    ? a.error
                    : typeof p.error === 'string'
                      ? p.error
                      : 'Failed to load hostel collections.',
            )
            setAssignments([])
            setPayments([])
            return
        }
        setAssignments(Array.isArray(a.data) ? a.data : [])
        setPayments(Array.isArray(p.data) ? p.data : [])
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const activeResidents = useMemo(
        () => assignments.filter((row) => String(row.status || '').toLowerCase() !== 'vacated').length,
        [assignments],
    )
    const pendingPayments = useMemo(
        () => payments.filter((row) => String(row.status || '').toLowerCase() !== 'paid').length,
        [payments],
    )

    return (
        <section className='space-y-6'>
            <div>
                <h1 className='text-2xl font-semibold text-black'>Hostel Warden Dashboard</h1>
                <p className='text-sm text-[#667085] mt-1'>
                    Assignments and payments from FastAPI ops hostel collections. Blocks/rooms, outpass, visitors and mess remain unsupported by backend.
                </p>
            </div>

            {live ? (
                <p className='text-xs font-medium text-[#027A48]'>
                    Live · GET /api/v1/ops/hostel-assignments · GET /api/v1/ops/hostel-payments
                </p>
            ) : null}
            {error ? <FeedbackState kind='error' title='Hostel API unavailable' description={error} /> : null}
            {loading ? <FeedbackState kind='loading' title='Loading hostel data' description='Fetching assignments and payments…' /> : null}

            {!loading && !error ? (
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <p className='text-sm text-[#808080]'>Active residents</p>
                        <p className='text-3xl font-bold text-[#0C1E5B] mt-2'>{activeResidents}</p>
                    </div>
                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <p className='text-sm text-[#808080]'>Assignment records</p>
                        <p className='text-3xl font-bold text-[#0C1E5B] mt-2'>{assignments.length}</p>
                    </div>
                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <p className='text-sm text-[#808080]'>Open payment rows</p>
                        <p className='text-3xl font-bold text-[#0C1E5B] mt-2'>{pendingPayments}</p>
                    </div>
                </div>
            ) : null}

            <div className='flex flex-wrap gap-3'>
                <NavLink to='/hostel-warden/assignments' className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md'>
                    Manage assignments
                </NavLink>
                <NavLink to='/hostel-warden/payments' className='bg-white text-[#515DEF] text-sm px-4 py-2 rounded-md border border-[#515DEF]'>
                    Hostel payments
                </NavLink>
            </div>
        </section>
    )
}

export default Dashboard
