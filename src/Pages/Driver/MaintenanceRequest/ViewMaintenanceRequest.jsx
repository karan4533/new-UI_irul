import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FeedbackState, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTransportDriverMaintenance } from '../../../services/api/transportApiService'

const Field = ({ label, value }) => (
    <div className='flex flex-col gap-y-1'>
        <span className='text-xs font-medium uppercase tracking-wide text-[#808080]'>{label}</span>
        <span className='text-sm text-[#1E1E1E] font-medium'>{value || '—'}</span>
    </div>
)

const ViewMaintenanceRequest = () => {
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
        const res = await listTransportDriverMaintenance()
        setLoading(false)
        if (!res.success) {
            setError(typeof res.error === 'string' ? res.error : 'Failed to load maintenance requests.')
            setRow(null)
            return
        }
        const found = (res.data || []).find(
            (item) => String(item.id) === String(id) || String(item.maintenanceRequestId) === String(id),
        ) || null
        setRow(found)
        if (!found) setError('Maintenance request not found in your driver scope.')
    }, [id])

    useEffect(() => {
        load()
    }, [load])

    if (!live) {
        return <FeedbackState kind='error' title='Live API required' description='Uses GET /api/v1/ops/transport-driver-maintenance (driver-scoped).' />
    }

    return (
        <section className='space-y-6'>
            <IntegrationNotice
                state='connected'
                title='Live maintenance request detail'
                description='Loaded from GET /api/v1/ops/transport-driver-maintenance within driver scope.'
            />
            {loading ? <FeedbackState kind='loading' title='Loading maintenance request' description='Fetching scoped maintenance rows…' /> : null}
            {error && !loading ? <FeedbackState kind='error' title='Maintenance request unavailable' description={error} /> : null}
            {!loading && row ? (
                <div className='bg-white rounded-2xl shadow-md p-4 md:p-6 space-y-4'>
                    <h2 className='text-xl font-semibold text-black'>{row.maintenanceRequestId || row.id}</h2>
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        <Field label='Vehicle' value={row.vehicleNumber} />
                        <Field label='Issue type' value={row.issueType} />
                        <Field label='Priority' value={row.priority} />
                        <Field label='Request date' value={row.requestDate} />
                        <Field label='Status' value={row.approvalStatus} />
                        <Field label='Description' value={row.description} />
                    </div>
                </div>
            ) : null}
            <div className='flex justify-center'>
                <Link to='/driver/maintenance-request' className='bg-[#515DEF] text-white text-sm px-8 py-2 rounded-md'>
                    Back to Maintenance Requests
                </Link>
            </div>
        </section>
    )
}

export default ViewMaintenanceRequest
