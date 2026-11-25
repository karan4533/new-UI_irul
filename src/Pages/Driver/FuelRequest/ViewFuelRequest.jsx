import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTransportDriverFuel } from '../../../services/api/transportApiService'

const Field = ({ label, value }) => (
    <div className='flex flex-col gap-y-1'>
        <span className='text-xs font-medium uppercase tracking-wide text-[#808080]'>{label}</span>
        <span className='text-sm text-[#1E1E1E] font-medium'>{value || '—'}</span>
    </div>
)

const ViewFuelRequest = () => {
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
        const res = await listTransportDriverFuel()
        setLoading(false)
        if (!res.success) {
            setError(typeof res.error === 'string' ? res.error : 'Failed to load fuel requests.')
            setRow(null)
            return
        }
        const found = (res.data || []).find(
            (item) => String(item.id) === String(id) || String(item.fuelRequestId) === String(id),
        ) || null
        setRow(found)
        if (!found) setError('Fuel request not found in your driver scope.')
    }, [id])

    useEffect(() => {
        load()
    }, [load])

    if (!live) {
        return <FeedbackState kind='error' title='Live API required' description='Uses GET /api/v1/ops/transport-driver-fuel (driver-scoped).' />
    }

    return (
        <section className='space-y-6'>
            <IntegrationNotice
                state='connected'
                title='Live fuel request detail'
                description='Loaded from GET /api/v1/ops/transport-driver-fuel within driver scope. GPS is not used here.'
            />
            {loading ? <FeedbackState kind='loading' title='Loading fuel request' description='Fetching scoped fuel rows…' /> : null}
            {error && !loading ? <FeedbackState kind='error' title='Fuel request unavailable' description={error} /> : null}
            {!loading && row ? (
                <div className='bg-white rounded-2xl shadow-md p-4 md:p-6 space-y-4'>
                    <h2 className='text-xl font-semibold text-black'>{row.fuelRequestId || row.id}</h2>
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        <Field label='Vehicle' value={row.vehicleNumber} />
                        <Field label='Fuel type' value={row.fuelType} />
                        <Field label='Quantity (L)' value={row.quantityLitres} />
                        <Field label='Estimated cost' value={row.estimatedCost} />
                        <Field label='Request date' value={row.requestDate} />
                        <Field label='Status' value={row.approvalStatus} />
                        <Field label='Remarks' value={row.remarks} />
                    </div>
                </div>
            ) : null}
            <div className='flex justify-center'>
                <Link to='/driver/fuel-request' className='bg-[#515DEF] text-white text-sm px-8 py-2 rounded-md'>
                    Back to Fuel Requests
                </Link>
            </div>
        </section>
    )
}

export default ViewFuelRequest
