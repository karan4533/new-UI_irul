import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FeedbackState, IntegrationNotice } from '../../../../Common/ui'
import { isLiveApiEnabled } from '../../../../services/api/tokenStore'
import { listTransportVehicleHealth } from '../../../../services/api/transportApiService'

const Field = ({ label, value }) => (
    <div className='flex flex-col gap-y-1'>
        <span className='text-xs font-medium uppercase tracking-wide text-[#808080]'>{label}</span>
        <span className='text-sm text-[#1E1E1E] font-medium'>{value || '—'}</span>
    </div>
)

const ViewVehicleHealthStatus = () => {
    const { id } = useParams()
    const live = isLiveApiEnabled()
    const [row, setRow] = useState(null)
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        if (!isLiveApiEnabled()) {
            setLoading(false)
            setError('Live API is disabled.')
            return
        }
        setLoading(true)
        setError('')
        const res = await listTransportVehicleHealth()
        setLoading(false)
        if (!res.success) {
            setError(typeof res.error === 'string' ? res.error : 'Failed to load vehicle health.')
            setRow(null)
            return
        }
        const found = (res.data || []).find((item) => String(item.id) === String(id)) || null
        setRow(found)
        if (!found) setError('Health record not found in your driver scope.')
    }, [id])

    useEffect(() => {
        load()
    }, [load])

    if (!live) {
        return <FeedbackState kind='error' title='Live API required' description='Uses GET /api/v1/ops/transport-vehicle-health (driver-scoped).' />
    }

    return (
        <section className='space-y-6'>
            <IntegrationNotice
                state='connected'
                title='Live vehicle health detail'
                description='Loaded from GET /api/v1/ops/transport-vehicle-health within driver scope.'
            />
            {loading ? <FeedbackState kind='loading' title='Loading health status' description='Fetching scoped health rows…' /> : null}
            {error && !loading ? <FeedbackState kind='error' title='Health status unavailable' description={error} /> : null}
            {!loading && row ? (
                <div className='bg-white rounded-2xl shadow-md p-4 md:p-6 space-y-4'>
                    <h2 className='text-xl font-semibold text-black'>{row.id}</h2>
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        <Field label='Vehicle' value={row.vehicleNumber} />
                        <Field label='Inspection date' value={row.inspectionDate} />
                        <Field label='Engine' value={row.engineStatus} />
                        <Field label='Tyres' value={row.tyreCondition} />
                        <Field label='Brakes' value={row.brakeCondition} />
                        <Field label='Lights' value={row.lightsStatus} />
                        <Field label='Overall' value={row.overallCondition} />
                        <Field label='Remarks' value={row.remarks} />
                    </div>
                </div>
            ) : null}
            <div className='flex justify-center'>
                <Link to='/driver/vehicle-management/vehicle-health-status' className='bg-[#515DEF] text-white text-sm px-8 py-2 rounded-md'>
                    Back to Vehicle Health
                </Link>
            </div>
        </section>
    )
}

export default ViewVehicleHealthStatus
