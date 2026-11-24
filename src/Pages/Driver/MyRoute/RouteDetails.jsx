import React, { useEffect, useState } from 'react'
import { InfoTile } from '../Components/VehicleShared'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTransportRoutes } from '../../../services/api/transportApiService'
const routeStatusBadgeColor = {
    Active: 'bg-emerald-50 text-emerald-700',
    Ready: 'bg-emerald-50 text-emerald-700',
    Inactive: 'bg-slate-100 text-slate-600',
}

const RouteDetails = () => {
    const live = isLiveApiEnabled()
    const [route, setRoute] = useState(null)
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            if (!live) {
                setLoading(false)
                setError('Live API is disabled.')
                return
            }
            setLoading(true)
            const res = await listTransportRoutes()
            if (cancelled) return
            if (!res.success) {
                setError(res.error || 'Failed to load assigned route.')
                setRoute(null)
                setLoading(false)
                return
            }
            setRoute((res.data || [])[0] || null)
            setError('')
            setLoading(false)
        }
        run()
        return () => {
            cancelled = true
        }
    }, [live])

    if (!live) {
        return (
            <FeedbackState
                kind='error'
                title='Live API required'
                description='Route details use GET /api/v1/ops/transport-routes (driver-scoped).'
            />
        )
    }

    const tiles = route
        ? [
            { key: 'routeName', label: 'Route Name', value: route.routeName, icon: 'routeName' },
            { key: 'startLocation', label: 'Start', value: route.startLocation, icon: 'route' },
            { key: 'endLocation', label: 'End', value: route.endLocation, icon: 'stops' },
            { key: 'vehicleNumber', label: 'Vehicle', value: route.vehicleNumber, icon: 'routeVehicle' },
            { key: 'totalStops', label: 'Stops', value: String(route.totalStops || 0), icon: 'students' },
            { key: 'status', label: 'Status', value: route.status, icon: 'routeStatus', isStatus: true },
        ]
        : []

    return (
        <section className='space-y-6'>
            <div className='bg-white rounded-2xl shadow-md p-4 md:p-6'>
                <div className='mb-6'>
                    <h2 className='text-xl font-semibold text-[#515DEF]'>Route Details</h2>
                    <p className='text-sm text-[#667085] mt-1'>Assigned route from /api/v1/ops/transport-routes</p>
                </div>
                {loading ? (
                    <p className='text-sm text-slate-500'>Loading assigned route…</p>
                ) : error ? (
                    <FeedbackState kind='error' title='Could not load route' description={error} />
                ) : !route ? (
                    <FeedbackState kind='empty' title='No assigned route' description='Transport Manager must assign a route linked to this driver profile.' />
                ) : (
                    <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'>
                        {tiles.map((tile) => (
                            <InfoTile
                                key={tile.key}
                                icon={tile.icon}
                                label={tile.label}
                                value={tile.value || '—'}
                                isStatus={tile.isStatus}
                                statusClassName={routeStatusBadgeColor[route.status]}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}

export default RouteDetails
