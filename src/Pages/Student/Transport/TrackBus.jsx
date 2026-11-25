import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import BusRouteCard from './Components/BusRouteCard'
import BusTrackingMap from '../../TransportManager/RouteData/Components/BusTrackingMap'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import useProtrackLive from '../../../Common/Transport/useProtrackLive'
import {
    SCHOOL_CAMPUS,
    resolveDestinationPosition,
} from '../../../Common/Transport/schoolCampusLocation'
import { apiClient } from '../../../services/api/apiClient'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    listTransportRoutes,
    listTransportStudentAssignments,
    listTransportVehicles,
} from '../../../services/api/transportApiService'

const plateKey = (value) => String(value || '').replace(/[\s-]/g, '').toUpperCase()

const TrackBus = ({ showRouteDetails = false }) => {
    const liveApi = isLiveApiEnabled()
    const [assignment, setAssignment] = useState(null)
    const [route, setRoute] = useState(null)
    const [vehicle, setVehicle] = useState(null)
    const [loading, setLoading] = useState(Boolean(liveApi))
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setAssignment(null)
            setRoute(null)
            setVehicle(null)
            setLoading(false)
            setError('Live API is off. Enable VITE_USE_MOCK=false for ProTrack GPS.')
            return
        }
        setLoading(true)
        setError('')

        // Prefer student/parent scoped payload when available.
        const mine = await apiClient.get('/api/v1/ops/my-transport', { skipMock: true })
        if (mine.success && mine.data) {
            const payload = mine.data
            const match = Array.isArray(payload.assignments) ? payload.assignments[0] : null
            const routes = Array.isArray(payload.routes) ? payload.routes : []
            const vehicles = Array.isArray(payload.vehicles) ? payload.vehicles : []
            const foundRoute = match
                ? routes.find((row) => (
                    String(row.id || '') === String(match.routeId || '')
                    || String(row.routeName || row.name || '').trim() === String(match.routeName || '').trim()
                )) || null
                : null
            const foundVehicle = match || foundRoute
                ? vehicles.find((row) => (
                    String(row.id || '') === String(match?.vehicleId || foundRoute?.vehicleId || '')
                    || plateKey(row.vehicleNumber) === plateKey(match?.vehicleNumber || foundRoute?.vehicleNumber)
                )) || null
                : null
            setAssignment(match)
            setRoute(foundRoute)
            setVehicle(foundVehicle)
            setLoading(false)
            if (!match) setError('No transport assignment found for this student.')
            return
        }

        const [aRes, rRes, vRes] = await Promise.all([
            listTransportStudentAssignments(),
            listTransportRoutes(),
            listTransportVehicles(),
        ])
        setLoading(false)
        if (!aRes.success) {
            setError(typeof aRes.error === 'string' ? aRes.error : (typeof mine.error === 'string' ? mine.error : 'Could not load transport assignment.'))
            setAssignment(null)
            setRoute(null)
            setVehicle(null)
            return
        }
        const match = Array.isArray(aRes.data) && aRes.data.length ? aRes.data[0] : null
        const foundRoute = match
            ? (rRes.data || []).find((row) => (
                String(row.id) === String(match.routeId)
                || String(row.routeName || '').trim() === String(match.routeName || '').trim()
            )) || null
            : null
        const foundVehicle = match || foundRoute
            ? (vRes.data || []).find((row) => (
                String(row.id) === String(match?.vehicleId || foundRoute?.vehicleId || '')
                || plateKey(row.vehicleNumber) === plateKey(match?.vehicleNumber || foundRoute?.vehicleNumber)
            )) || null
            : null
        setAssignment(match)
        setRoute(foundRoute)
        setVehicle(foundVehicle)
        if (!match) setError('No transport assignment found.')
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const preferredImei = assignment?.imei || assignment?.gpsImei
        || route?.imei || route?.gpsImei
        || vehicle?.imei || vehicle?.gpsImei
        || ''
    const preferredPlate = assignment?.vehicleNumber || route?.vehicleNumber || vehicle?.vehicleNumber || ''

    const gps = useProtrackLive({
        panel: 'parent',
        preferredImei,
        preferredPlate,
        fallbackPanel: 'admin',
    })

    const hasLiveGps = Boolean(gps.livePosition)
    const view = useMemo(() => ({
        routeName: assignment?.routeName || route?.routeName || 'Assigned route',
        vehicleNumber: preferredPlate || '—',
        driverName: assignment?.driverName || route?.driverName || vehicle?.driverName || 'Assigned driver',
        driverContact: assignment?.driverContact || route?.driverContact || vehicle?.driverContact || '',
        startLocation: assignment?.stopName || assignment?.startLocation || route?.startLocation || 'Pickup',
        endLocation: route?.endLocation || SCHOOL_CAMPUS.name,
    }), [assignment, preferredPlate, route, vehicle])

    const stats = hasLiveGps
        ? gps.stats
        : {
            progress: '—',
            distanceLeft: gps.loading ? 'Loading ProTrack…' : 'Waiting for GPS fix',
            eta: '—',
            speed: '—',
        }

    return (
        <section className='space-y-6'>
            {showRouteDetails ? <BusRouteCard title='Bus Route Details' /> : null}

            <div className='bg-white rounded-2xl shadow-md p-4 space-y-3'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div>
                        <h2 className='text-xl font-medium text-black'>Track Bus Location</h2>
                        <p className='text-sm text-[#667085] mt-1'>
                            Live positions from ProTrack365 via FastAPI `/api/v1/protrack`.
                        </p>
                    </div>
                    <button
                        type='button'
                        onClick={() => { load(); gps.refresh() }}
                        className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#D9D9D9] rounded-md px-4 py-2 cursor-pointer'
                    >
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>

                <IntegrationNotice
                    state={!liveApi ? 'mock' : (gps.error && !hasLiveGps ? 'failed' : hasLiveGps ? 'connected' : gps.loading ? 'syncing' : 'connected')}
                    title={hasLiveGps ? 'ProTrack365 live GPS' : liveApi ? 'ProTrack365 GPS' : 'Live API off'}
                    description={
                        !liveApi
                            ? 'Enable VITE_USE_MOCK=false to poll ProTrack.'
                            : hasLiveGps
                                ? `Polling IMEI ${gps.imei || preferredImei}.`
                                : (gps.error || error || 'Waiting for a mapped IMEI/plate and ProTrack fix. Demo map geometry is never labeled live.')
                    }
                />
            </div>

            {loading ? <FeedbackState kind='loading' title='Loading assignment' description='Fetching your transport route…' /> : null}

            {!loading && !assignment ? (
                <FeedbackState
                    kind='empty'
                    title='No transport assignment'
                    description={error || 'Ask Transport Manager to assign a route/vehicle with a ProTrack IMEI.'}
                />
            ) : null}

            {!loading && assignment ? (
                <div className='bg-white rounded-2xl shadow-md overflow-hidden'>
                    <BusTrackingMap
                        routeName={view.routeName}
                        vehicleNumber={view.vehicleNumber}
                        driverName={view.driverName}
                        driverContact={view.driverContact}
                        startLocation={view.startLocation}
                        startSubtitle='Your pickup'
                        endLocation={view.endLocation}
                        endSubtitle='School Campus'
                        endPosition={resolveDestinationPosition({
                            endLat: route?.endLat,
                            endLng: route?.endLng,
                            endLocation: view.endLocation,
                        })}
                        busLabel={view.vehicleNumber}
                        stats={stats}
                        livePosition={gps.livePosition}
                        liveStatusLabel={gps.liveStatusLabel}
                        trackingMode={hasLiveGps ? 'live' : 'waiting'}
                    />
                </div>
            ) : null}
        </section>
    )
}

export default TrackBus
