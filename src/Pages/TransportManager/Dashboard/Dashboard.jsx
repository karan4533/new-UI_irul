import React, { useCallback, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Bus, MapPinned, Users, UserRound } from 'lucide-react'
import { FeedbackState, IntegrationNotice, PageHeader } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    listTransportDrivers,
    listTransportRoutes,
    listTransportStudentAssignments,
    listTransportVehicles,
} from '../../../services/api/transportApiService'

const Dashboard = () => {
    const live = isLiveApiEnabled()
    const [counts, setCounts] = useState({ drivers: 0, vehicles: 0, routes: 0, students: 0 })
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')
    const loadGenRef = React.useRef(0)

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setLoading(false)
            return
        }
        const gen = ++loadGenRef.current
        setLoading(true)
        setError('')
        try {
            // Sequential loads reduce request fan-out on local uvicorn; NullPool is the real fix.
            const d = await listTransportDrivers()
            if (gen !== loadGenRef.current) return
            const v = await listTransportVehicles()
            if (gen !== loadGenRef.current) return
            const r = await listTransportRoutes()
            if (gen !== loadGenRef.current) return
            const s = await listTransportStudentAssignments()
            if (gen !== loadGenRef.current) return
            if (!d.success || !v.success || !r.success || !s.success) {
                setError(
                    [d.error, v.error, r.error, s.error].find((item) => typeof item === 'string') ||
                        'Failed to load transport collections.',
                )
                return
            }
            setCounts({
                drivers: (d.data || []).length,
                vehicles: (v.data || []).length,
                routes: (r.data || []).length,
                students: (s.data || []).filter((row) => String(row.status || '').toLowerCase() !== 'inactive').length,
            })
        } finally {
            if (gen === loadGenRef.current) setLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
        return () => {
            loadGenRef.current += 1
        }
    }, [load])

    const metrics = [
        { label: 'Drivers', value: counts.drivers, icon: UserRound, to: '/transport-manager/driver-management' },
        { label: 'Vehicles', value: counts.vehicles, icon: Bus, to: '/transport-manager/vehicle-management' },
        { label: 'Routes', value: counts.routes, icon: MapPinned, to: '/transport-manager/route-management' },
        { label: 'Active student assignments', value: counts.students, icon: Users, to: '/transport-manager/student-transport' },
    ]

    return (
        <section className='space-y-6'>
            <PageHeader
                title='Transport Manager Dashboard'
                description='Fleet counts from FastAPI ops transport collections.'
                context={live ? 'Live · /api/v1/ops/transport-*' : 'Live API disabled'}
            />

            {live && !error && !loading ? (
                <IntegrationNotice
                    state='connected'
                    title='Fleet KPI counts are live'
                    description='Drivers, vehicles, routes and student assignments from /api/v1/ops/transport-*. GPS / ProTrack remains mock on Route Data.'
                />
            ) : null}
            {!live ? (
                <IntegrationNotice state='mock' title='Live API disabled' description='Enable live API for transport ops KPI counts.' />
            ) : null}
            {error ? (
                <>
                    <IntegrationNotice state='failed' title='Transport API failed' description={error} />
                    <FeedbackState kind='error' title='Transport API unavailable' description={error} />
                </>
            ) : null}
            {loading ? <FeedbackState kind='loading' title='Loading transport data' description='Fetching ops collections…' /> : null}

            {!loading && !error ? (
                <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4'>
                    {metrics.map(({ label, value, icon: Icon, to }) => (
                        <NavLink
                            key={label}
                            to={to}
                            className='bg-white rounded-2xl shadow-md p-4 border border-transparent hover:border-[#515DEF]'
                        >
                            <div className='flex items-start justify-between'>
                                <div>
                                    <p className='text-sm text-[#808080]'>{label}</p>
                                    <p className='text-3xl font-bold text-[#0C1E5B] mt-2'>{value}</p>
                                </div>
                                <span className='grid size-10 place-items-center rounded-xl bg-[#EEF2FF] text-[#515DEF]'>
                                    <Icon size={18} aria-hidden='true' />
                                </span>
                            </div>
                        </NavLink>
                    ))}
                </div>
            ) : null}

            <div className='flex flex-wrap gap-3'>
                <NavLink to='/transport-manager/driver-management' className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md'>
                    Manage drivers
                </NavLink>
                <NavLink to='/transport-manager/student-transport' className='bg-white text-[#515DEF] text-sm px-4 py-2 rounded-md border border-[#515DEF]'>
                    Student assignments
                </NavLink>
                <NavLink to='/transport-manager/assign-duty' className='bg-white text-[#515DEF] text-sm px-4 py-2 rounded-md border border-[#515DEF]'>
                    Duties
                </NavLink>
            </div>
        </section>
    )
}

export default Dashboard
