import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import BusTrackingMap from './Components/BusTrackingMap'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import useProtrackLive from '../../../Common/Transport/useProtrackLive'
import {
    SCHOOL_CAMPUS,
    parseMapLatLng,
    resolveDestinationPosition,
} from '../../../Common/Transport/schoolCampusLocation'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTransportRoutes, listTransportVehicles } from '../../../services/api/transportApiService'
import { getRouteById } from '../RouteManagement/routeManagementData'
import { VEHICLES } from '../VehicleManagement/vehicleManagementData'

const Field = ({ label, value }) => (
    <div className='flex flex-col gap-y-1'>
        <span className='text-xs font-medium uppercase tracking-wide text-[#808080]'>{label}</span>
        <span className='text-sm text-[#1E1E1E] font-medium'>{value || '—'}</span>
    </div>
)

const plateKey = (value) => String(value || '').replace(/[\s-]/g, '').toUpperCase()

const TrackBus = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const apiLive = isLiveApiEnabled()
    const [route, setRoute] = useState(null)
    const [vehicle, setVehicle] = useState(null)
    const [loading, setLoading] = useState(Boolean(apiLive))
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            const localRoute = getRouteById(id)
            setRoute(localRoute || null)
            const vehicles = VEHICLES
            setVehicle(
                vehicles.find((row) => (
                    (localRoute?.vehicleId && row.id === localRoute.vehicleId)
                    || plateKey(row.vehicleNumber) === plateKey(localRoute?.vehicleNumber)
                )) || null,
            )
            setLoading(false)
            setError(localRoute ? '' : 'Route not found.')
            return
        }
        setLoading(true)
        setError('')
        const [routesRes, vehiclesRes] = await Promise.all([
            listTransportRoutes(),
            listTransportVehicles(),
        ])
        setLoading(false)
        if (!routesRes.success) {
            setRoute(null)
            setVehicle(null)
            setError(typeof routesRes.error === 'string' ? routesRes.error : 'Failed to load routes.')
            return
        }
        const found = (routesRes.data || []).find((row) => String(row.id) === String(id)) || null
        const vehicles = vehiclesRes.success && Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []
        const matchedVehicle = found
            ? vehicles.find((row) => (
                (found.vehicleId && String(row.id) === String(found.vehicleId))
                || plateKey(row.vehicleNumber) === plateKey(found.vehicleNumber)
            )) || null
            : null
        setRoute(found)
        setVehicle(matchedVehicle)
        if (!found) setError('Route not found on the server.')
    }, [id])

    useEffect(() => {
        load()
    }, [load])

    const preferredImei = route?.imei || route?.gpsImei || vehicle?.imei || vehicle?.gpsImei || ''
    const preferredPlate = route?.vehicleNumber || vehicle?.vehicleNumber || ''
    const gps = useProtrackLive({
        panel: 'admin',
        preferredImei,
        preferredPlate,
    })

    const hasLiveGps = Boolean(gps.livePosition)
    const stats = useMemo(() => (
        hasLiveGps
            ? gps.stats
            : {
                progress: '—',
                distanceLeft: gps.loading ? 'Loading ProTrack…' : 'Waiting for GPS fix',
                eta: '—',
                speed: '—',
            }
    ), [gps.loading, gps.stats, hasLiveGps])

    return (
        <section className='space-y-6'>
            <div className='flex flex-wrap items-center gap-3'>
                <button
                    type='button'
                    onClick={() => navigate('/transport-manager/route-data')}
                    className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer'
                >
                    <ArrowLeft size={18} />
                    Back to Route Data
                </button>
                <button
                    type='button'
                    onClick={() => gps.refresh()}
                    className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#D9D9D9] rounded-md px-4 py-2 cursor-pointer'
                >
                    <RefreshCw size={16} /> Refresh GPS
                </button>
            </div>

            {apiLive ? (
                <IntegrationNotice
                    state={gps.error && !hasLiveGps ? 'failed' : hasLiveGps ? 'connected' : gps.loading ? 'syncing' : 'connected'}
                    title={hasLiveGps ? 'ProTrack365 live GPS' : gps.loading ? 'Connecting to ProTrack365' : 'ProTrack365 GPS'}
                    description={
                        hasLiveGps
                            ? `Polling /api/v1/protrack/track for IMEI ${gps.imei || preferredImei}.`
                            : (gps.error || 'Map shows live fix when IMEI/plate matches a ProTrack device. Demo geometry is never labeled live.')
                    }
                />
            ) : (
                <IntegrationNotice
                    state='mock'
                    title='Live API off'
                    description='Enable VITE_USE_MOCK=false to poll ProTrack365 through FastAPI.'
                />
            )}

            {error ? <IntegrationNotice state='failed' title='Route metadata unavailable' description={error} /> : null}
            {loading ? <FeedbackState kind='loading' title='Loading route' description='Fetching route and vehicle details…' /> : null}

            {!loading && !route ? (
                <div className='bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]'>
                    Route not found or could not be loaded.
                </div>
            ) : null}

            {!loading && route ? (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <h1 className='text-2xl font-semibold text-black'>{route.routeName}</h1>
                        <p className='text-sm text-[#667085] mt-2'>
                            <span className='font-medium text-[#1E1E1E]'>Route ID: {route.id}</span>
                            {route.distance ? ` · ${route.distance}` : ''}
                            {route.estimatedTime ? ` · ${route.estimatedTime}` : ''}
                        </p>
                        {gps.imei ? (
                            <p className='text-sm text-[#667085] mt-3'>
                                Mapped ProTrack IMEI: {gps.imei}
                                {route.vehicleNumber ? ` · plate ${route.vehicleNumber}` : ''}
                            </p>
                        ) : (
                            <p className='text-sm text-[#667085] mt-3'>
                                Store a verified IMEI (or matching plate) on this route/vehicle before live tracking can poll.
                            </p>
                        )}
                    </div>

                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <h2 className='text-lg font-semibold text-black mb-4'>Route Details</h2>
                        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'>
                            <Field label='Vehicle Number' value={route.vehicleNumber} />
                            <Field label='Vehicle ID' value={route.vehicleId} />
                            <Field label='Driver Name' value={route.driverName} />
                            <Field label='Driver Contact' value={route.driverContact} />
                            <Field label='Start Location' value={route.startLocation} />
                            <Field label='End Location' value={route.endLocation} />
                            <Field label='IMEI' value={gps.imei || preferredImei || '—'} />
                            <Field
                                label='GPS Status'
                                value={
                                    hasLiveGps
                                        ? gps.liveStatusLabel || 'Live fix'
                                        : gps.loading
                                            ? 'Loading…'
                                            : (gps.error || 'Waiting for ProTrack fix')
                                }
                            />
                        </div>
                    </div>

                    <div className='bg-white rounded-2xl shadow-md overflow-hidden'>
                        <BusTrackingMap
                            routeName={route.routeName}
                            vehicleNumber={route.vehicleNumber}
                            driverName={route.driverName}
                            driverContact={route.driverContact}
                            startLocation={route.startLocation}
                            startSubtitle='Pickup Point'
                            endLocation={route.endLocation || SCHOOL_CAMPUS.name}
                            endSubtitle='School Campus'
                            startPosition={parseMapLatLng(route.startLat, route.startLng)}
                            endPosition={resolveDestinationPosition({
                                endLat: route.endLat,
                                endLng: route.endLng,
                                endLocation: route.endLocation || SCHOOL_CAMPUS.name,
                            })}
                            busLabel={route.vehicleNumber || route.vehicleId}
                            stats={stats}
                            livePosition={gps.livePosition}
                            liveStatusLabel={gps.liveStatusLabel}
                            trackingMode={hasLiveGps ? 'live' : 'waiting'}
                        />
                    </div>
                </>
            ) : null}
        </section>
    )
}

export default TrackBus
