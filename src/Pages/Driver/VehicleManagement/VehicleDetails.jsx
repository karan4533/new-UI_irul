import React, { useEffect, useState } from 'react'
import { InfoTile } from '../Components/VehicleShared'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTransportVehicles } from '../../../services/api/transportApiService'
const vehicleStatusBadgeColor = {
    Active: 'bg-emerald-50 text-emerald-700',
    Ready: 'bg-emerald-50 text-emerald-700',
    Maintenance: 'bg-amber-50 text-amber-700',
    Inactive: 'bg-slate-100 text-slate-600',
}

const VehicleDetails = () => {
    const live = isLiveApiEnabled()
    const [vehicle, setVehicle] = useState(null)
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
            const res = await listTransportVehicles()
            if (cancelled) return
            if (!res.success) {
                setError(res.error || 'Failed to load assigned vehicle.')
                setVehicle(null)
                setLoading(false)
                return
            }
            setVehicle((res.data || [])[0] || null)
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
                description='Vehicle details use GET /api/v1/ops/transport-vehicles (driver-scoped).'
            />
        )
    }

    const tiles = vehicle
        ? [
            { key: 'vehicleNumber', label: 'Vehicle Number', value: vehicle.vehicleNumber, icon: 'number' },
            { key: 'vehicleType', label: 'Vehicle Type', value: vehicle.vehicleType, icon: 'type' },
            { key: 'capacity', label: 'Capacity', value: String(vehicle.capacity || '—'), icon: 'capacity' },
            { key: 'driverName', label: 'Driver Name', value: vehicle.driverName, icon: 'driver' },
            { key: 'driverContact', label: 'Driver Contact', value: vehicle.driverContact, icon: 'contact' },
            { key: 'status', label: 'Status', value: vehicle.status, icon: 'status', isStatus: true },
        ]
        : []

    return (
        <section className='space-y-6'>
            <div className='bg-white rounded-2xl shadow-md p-4 md:p-6'>
                <div className='mb-6'>
                    <h2 className='text-xl font-semibold text-[#515DEF]'>Vehicle Details</h2>
                    <p className='text-sm text-[#667085] mt-1'>Assigned vehicle information from /api/v1/ops/transport-vehicles</p>
                </div>
                {loading ? (
                    <p className='text-sm text-slate-500'>Loading assigned vehicle…</p>
                ) : error ? (
                    <FeedbackState kind='error' title='Could not load vehicle' description={error} />
                ) : !vehicle ? (
                    <FeedbackState kind='empty' title='No assigned vehicle' description='Transport Manager must assign a vehicle linked to this driver profile (matching email / vehicle number).' />
                ) : (
                    <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'>
                        {tiles.map((tile) => (
                            <InfoTile
                                key={tile.key}
                                icon={tile.icon}
                                label={tile.label}
                                value={tile.value || '—'}
                                isStatus={tile.isStatus}
                                statusClassName={vehicleStatusBadgeColor[vehicle.status]}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}

export default VehicleDetails
