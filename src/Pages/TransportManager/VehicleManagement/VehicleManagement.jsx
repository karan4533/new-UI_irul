import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTransportVehicles, upsertTransportVehicle } from '../../../services/api/transportApiService'

const emptyForm = {
    vehicleNumber: '',
    vehicleType: 'School Van (32 Seater)',
    category: 'Bus',
    capacity: '32',
    driverName: '',
    driverContact: '',
    status: 'Active',
    operationalState: 'Ready',
}

const VehicleManagement = () => {
    const live = isLiveApiEnabled()
    const [rows, setRows] = useState([])
    const [form, setForm] = useState(emptyForm)
    const [loading, setLoading] = useState(Boolean(live))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const res = await listTransportVehicles()
        setLoading(false)
        if (!res.success) {
            setError(typeof res.error === 'string' ? res.error : 'Failed to load vehicles.')
            setRows([])
            return
        }
        setRows(Array.isArray(res.data) ? res.data : [])
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return rows
        return rows.filter((row) =>
            `${row.id} ${row.vehicleNumber} ${row.vehicleType} ${row.driverName}`.toLowerCase().includes(q),
        )
    }, [rows, search])

    const handleSave = async () => {
        if (!form.vehicleNumber.trim()) {
            toast.error('Vehicle registration number is required.')
            return
        }
        setSaving(true)
        const res = await upsertTransportVehicle({
            ...form,
            capacity: Number(form.capacity) || 0,
        })
        setSaving(false)
        if (!res.success) {
            toast.error(typeof res.error === 'string' ? res.error : 'Could not save vehicle.')
            return
        }
        toast.success('Vehicle saved on the server.')
        setForm(emptyForm)
        setRows(res.rows || [])
    }

    return (
        <section className='space-y-6'>
            <div>
                <h1 className='text-2xl font-semibold text-black'>Vehicle Management</h1>
                <p className='text-sm text-[#667085] mt-1'>Persisted on /api/v1/ops/transport-vehicles.</p>
            </div>
            {live && !error && !loading ? (
                <IntegrationNotice state='connected' title='Vehicles are live' description='GET/PUT /api/v1/ops/transport-vehicles. No localStorage fallback on failure.' />
            ) : null}
            {!live ? <IntegrationNotice state='mock' title='Live API disabled' description='Enable live API to manage fleet vehicles on FastAPI ops.' /> : null}
            {error ? (
                <>
                    <IntegrationNotice state='failed' title='Vehicles API failed' description={error} />
                    <FeedbackState kind='error' title='Vehicles API unavailable' description={error} />
                </>
            ) : null}
            {loading ? <FeedbackState kind='loading' title='Loading vehicles' description='Fetching transport vehicles…' /> : null}

            {!loading && !error ? (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
                        <h2 className='text-lg font-semibold'>Add / update vehicle</h2>
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                            {[
                                ['vehicleNumber', 'Registration'],
                                ['vehicleType', 'Type'],
                                ['category', 'Category'],
                                ['capacity', 'Capacity'],
                                ['driverName', 'Driver name'],
                                ['driverContact', 'Driver contact'],
                            ].map(([key, label]) => (
                                <div key={key} className='flex flex-col gap-y-2'>
                                    <label className='text-sm text-[#808080]'>{label}</label>
                                    <input
                                        value={form[key]}
                                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                                        className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2'
                                    />
                                </div>
                            ))}
                        </div>
                        <button type='button' disabled={saving} onClick={handleSave} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md disabled:opacity-60'>
                            {saving ? 'Saving…' : 'Save vehicle'}
                        </button>
                    </div>

                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder='Search vehicles…'
                            className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2 w-full md:max-w-sm mb-4'
                        />
                        <div className='overflow-x-auto'>
                            <table className='w-full text-sm text-left'>
                                <thead className='text-xs bg-[#EDEEF5]'>
                                    <tr>
                                        <th className='px-2 py-3'>ID</th>
                                        <th className='px-2 py-3'>Registration</th>
                                        <th className='px-2 py-3'>Type</th>
                                        <th className='px-2 py-3'>Capacity</th>
                                        <th className='px-2 py-3'>Driver</th>
                                        <th className='px-2 py-3'>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={6} className='px-2 py-8 text-center text-[#667085]'>No vehicle records.</td></tr>
                                    ) : filtered.map((row) => (
                                        <tr key={row.id} className='border-b border-[#f2f4f7]'>
                                            <td className='px-2 py-3'>{row.id}</td>
                                            <td className='px-2 py-3'>{row.vehicleNumber}</td>
                                            <td className='px-2 py-3'>{row.vehicleType || row.category}</td>
                                            <td className='px-2 py-3'>{row.capacity || '—'}</td>
                                            <td className='px-2 py-3'>{row.driverName || '—'}</td>
                                            <td className='px-2 py-3'>{row.operationalState || row.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : null}
        </section>
    )
}

export default VehicleManagement
