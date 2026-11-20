import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    listTransportDrivers,
    listTransportDuties,
    listTransportRoutes,
    listTransportVehicles,
    upsertTransportDuty,
} from '../../../services/api/transportApiService'

const emptyForm = {
    dutyDate: new Date().toISOString().slice(0, 10),
    routeId: '',
    routeName: '',
    vehicleId: '',
    vehicleNumber: '',
    driverId: '',
    driverName: '',
    shift: 'Morning',
    status: 'Scheduled',
}

const AssignDuty = () => {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [routes, setRoutes] = useState([])
    const [vehicles, setVehicles] = useState([])
    const [drivers, setDrivers] = useState([])
    const [form, setForm] = useState(emptyForm)
    const [loading, setLoading] = useState(Boolean(live))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const loadGenRef = React.useRef(0)

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        const gen = ++loadGenRef.current
        setLoading(true)
        setError('')
        try {
            const d = await listTransportDuties()
            if (gen !== loadGenRef.current) return
            const r = await listTransportRoutes()
            if (gen !== loadGenRef.current) return
            const v = await listTransportVehicles()
            if (gen !== loadGenRef.current) return
            const dr = await listTransportDrivers()
            if (gen !== loadGenRef.current) return
            if (!d.success) {
                setError(typeof d.error === 'string' ? d.error : 'Failed to load duties.')
                setRows([])
                return
            }
            setRows(Array.isArray(d.data) ? d.data : [])
            setRoutes(r.success && Array.isArray(r.data) ? r.data : [])
            setVehicles(v.success && Array.isArray(v.data) ? v.data : [])
            setDrivers(dr.success && Array.isArray(dr.data) ? dr.data : [])
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

    const sorted = useMemo(() => rows, [rows])

    const handleSave = async () => {
        if (!form.routeId || !form.vehicleId || !form.driverId) {
            toast.error('Route, vehicle and driver are required.')
            return
        }
        setSaving(true)
        const res = await upsertTransportDuty(form)
        setSaving(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not save duty.')
            return
        }
        toast.success('Duty saved on the server.')
        setForm(emptyForm)
        setRows(res.rows || [])
    }

    return (
        <section className='space-y-6'>
            <div>
                <h1 className='text-2xl font-semibold text-black'>Assign Duty</h1>
                <p className='text-sm text-[#667085] mt-1'>Persisted on /api/v1/ops/transport-duties.</p>
            </div>
            {live ? <p className='text-xs font-medium text-[#027A48]'>Live · GET/PUT /api/v1/ops/transport-duties</p> : null}
            {error ? <FeedbackState kind='error' title='Duties API unavailable' description={error} /> : null}
            {loading ? <FeedbackState kind='loading' title='Loading duties' description='Fetching transport duties…' /> : null}

            {!loading && !error ? (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
                        <h2 className='text-lg font-semibold'>Schedule duty</h2>
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Date</label>
                                <input type='date' value={form.dutyDate} onChange={(e) => setForm((p) => ({ ...p, dutyDate: e.target.value }))} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Route</label>
                                <select
                                    value={form.routeId}
                                    onChange={(e) => {
                                        const route = routes.find((row) => String(row.id) === String(e.target.value))
                                        setForm((p) => ({ ...p, routeId: e.target.value, routeName: route?.routeName || '' }))
                                    }}
                                    className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2'
                                >
                                    <option value=''>Select route</option>
                                    {routes.map((route) => <option key={route.id} value={route.id}>{route.routeName || route.id}</option>)}
                                </select>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Vehicle</label>
                                <select
                                    value={form.vehicleId}
                                    onChange={(e) => {
                                        const vehicle = vehicles.find((row) => String(row.id) === String(e.target.value))
                                        setForm((p) => ({ ...p, vehicleId: e.target.value, vehicleNumber: vehicle?.vehicleNumber || '' }))
                                    }}
                                    className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2'
                                >
                                    <option value=''>Select vehicle</option>
                                    {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicleNumber || vehicle.id}</option>)}
                                </select>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Driver</label>
                                <select
                                    value={form.driverId}
                                    onChange={(e) => {
                                        const driver = drivers.find((row) => String(row.id) === String(e.target.value))
                                        setForm((p) => ({ ...p, driverId: e.target.value, driverName: driver?.name || `${driver?.firstName || ''} ${driver?.lastName || ''}`.trim() }))
                                    }}
                                    className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2'
                                >
                                    <option value=''>Select driver</option>
                                    {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name || driver.id}</option>)}
                                </select>
                            </div>
                            <div className='flex flex-col gap-y-2'>
                                <label className='text-sm text-[#808080]'>Shift</label>
                                <input value={form.shift} onChange={(e) => setForm((p) => ({ ...p, shift: e.target.value }))} className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2' />
                            </div>
                        </div>
                        <button type='button' disabled={saving} onClick={handleSave} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md disabled:opacity-60'>
                            {saving ? 'Saving…' : 'Save duty'}
                        </button>
                    </div>

                    <div className='bg-white rounded-2xl shadow-md p-4 overflow-x-auto'>
                        <table className='w-full text-sm text-left'>
                            <thead className='text-xs bg-[#EDEEF5]'>
                                <tr>
                                    <th className='px-2 py-3'>ID</th>
                                    <th className='px-2 py-3'>Date</th>
                                    <th className='px-2 py-3'>Route</th>
                                    <th className='px-2 py-3'>Vehicle</th>
                                    <th className='px-2 py-3'>Driver</th>
                                    <th className='px-2 py-3'>Shift</th>
                                    <th className='px-2 py-3'>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 ? (
                                    <tr><td colSpan={7} className='px-2 py-8 text-center text-[#667085]'>No duty records.</td></tr>
                                ) : sorted.map((row) => (
                                    <tr key={row.id} className='border-b border-[#f2f4f7]'>
                                        <td className='px-2 py-3'>{row.id}</td>
                                        <td className='px-2 py-3'>{row.dutyDate || '—'}</td>
                                        <td className='px-2 py-3'>{row.routeName || row.routeId}</td>
                                        <td className='px-2 py-3'>{row.vehicleNumber || row.vehicleId}</td>
                                        <td className='px-2 py-3'>{row.driverName || row.driverId}</td>
                                        <td className='px-2 py-3'>{row.shift || '—'}</td>
                                        <td className='px-2 py-3'>{row.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : null}
        </section>
    )
}

export default AssignDuty
