import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bus, Navigation, Wrench, Fuel, RefreshCw, Clock } from 'lucide-react'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    listTransportDuties,
    listTransportDriverFuel,
    listTransportDriverMaintenance,
    listTransportRoutes,
    listTransportVehicles,
} from '../../../services/api/transportApiService'

const Dashboard = () => {
    const live = isLiveApiEnabled()
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')
    const [duties, setDuties] = useState([])
    const [vehicles, setVehicles] = useState([])
    const [routes, setRoutes] = useState([])
    const [fuel, setFuel] = useState([])
    const [maintenance, setMaintenance] = useState([])

    const load = useCallback(async () => {
        if (!live) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        const [d, v, r, f, m] = await Promise.all([
            listTransportDuties(),
            listTransportVehicles(),
            listTransportRoutes(),
            listTransportDriverFuel(),
            listTransportDriverMaintenance(),
        ])
        setDuties(d.success ? d.data || [] : [])
        setVehicles(v.success ? v.data || [] : [])
        setRoutes(r.success ? r.data || [] : [])
        setFuel(f.success ? f.data || [] : [])
        setMaintenance(m.success ? m.data || [] : [])
        const parts = []
        if (!d.success) parts.push(`duties: ${d.error}`)
        if (!v.success) parts.push(`vehicles: ${v.error}`)
        if (!r.success) parts.push(`routes: ${r.error}`)
        setError(parts.join(' · '))
        setLoading(false)
    }, [live])

    useEffect(() => {
        load()
    }, [load])

    const kpis = useMemo(() => ({
        vehicles: vehicles.length,
        routes: routes.length,
        openDuties: duties.filter((row) => !['Completed'].includes(String(row.status || ''))).length,
        openFuel: fuel.filter((row) => String(row.approvalStatus || '') === 'Pending').length,
        openMaintenance: maintenance.filter((row) => String(row.approvalStatus || '') === 'Pending').length,
    }), [vehicles, routes, duties, fuel, maintenance])

    if (!live) {
        return <FeedbackState kind='error' title='Live API required' description='Driver dashboard uses /api/v1/ops/transport-* (driver-scoped).' />
    }

    return (
        <section className='space-y-6'>
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                <div>
                    <h1 className='text-xl font-bold text-slate-900'>Driver Operations Dashboard</h1>
                    <p className='text-xs text-slate-500'>Assigned fleet scope from transport ops collections.</p>
                </div>
                <button type='button' onClick={load} className='rounded-xl border border-slate-200 bg-white p-2 text-slate-600' title='Refresh'>
                    <RefreshCw size={14} />
                </button>
            </div>

            <IntegrationNotice
                state='connected'
                title='Assigned ops are LIVE — GPS is not'
                description='LIVE: duties, vehicle, route, stops, boarding attendance, health, fuel, maintenance (driver-scoped). BLOCKED: vehicle document upload (no file API). MOCK elsewhere: Track Bus / DEMO GPS — never claimed LIVE in this portal.'
            />


            {loading ? <p className='text-sm text-slate-500'>Loading live driver data…</p> : null}
            {error ? <FeedbackState kind='error' title='Partial load issues' description={error} /> : null}

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4'>
                {[
                    { label: 'Assigned Vehicles', value: kpis.vehicles, icon: Bus, to: '/driver/vehicle-management/vehicle-details' },
                    { label: 'Assigned Routes', value: kpis.routes, icon: Navigation, to: '/driver/my-route/route-details' },
                    { label: 'Open Duties', value: kpis.openDuties, icon: Clock, to: '/driver/my-duty' },
                    { label: 'Pending Fuel', value: kpis.openFuel, icon: Fuel, to: '/driver/fuel-request' },
                    { label: 'Pending Maintenance', value: kpis.openMaintenance, icon: Wrench, to: '/driver/maintenance-request' },
                ].map((card) => (
                    <Link key={card.label} to={card.to} className='rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-indigo-300'>
                        <div className='flex items-center justify-between'>
                            <div>
                                <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>{card.label}</p>
                                <h3 className='text-2xl font-bold text-slate-900 mt-1'>{card.value}</h3>
                            </div>
                            <div className='rounded-xl bg-indigo-50 p-3 text-indigo-600'><card.icon size={20} /></div>
                        </div>
                    </Link>
                ))}
            </div>

            <div className='rounded-2xl bg-white border border-slate-200 p-4'>
                <h2 className='text-base font-semibold mb-3'>Recent duties</h2>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead className='text-xs uppercase bg-slate-50 text-slate-600'>
                            <tr>
                                <th className='px-2 py-2 text-left'>Duty</th>
                                <th className='px-2 py-2 text-left'>Route</th>
                                <th className='px-2 py-2 text-left'>Vehicle</th>
                                <th className='px-2 py-2 text-left'>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {duties.slice(0, 8).map((d) => (
                                <tr key={d.id} className='border-t border-slate-100'>
                                    <td className='px-2 py-3 font-mono'>{d.id}</td>
                                    <td className='px-2 py-3'>{d.routeName || '—'}</td>
                                    <td className='px-2 py-3'>{d.vehicleNumber || '—'}</td>
                                    <td className='px-2 py-3'>{d.status}</td>
                                </tr>
                            ))}
                            {duties.length === 0 && (
                                <tr><td colSpan={4} className='px-2 py-6 text-center text-slate-400'>No duties in driver scope yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    )
}

export default Dashboard
