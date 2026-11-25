import React from 'react'
import { Link } from 'react-router-dom'
import { FeedbackState } from '../../../Common/ui'

const EditMaintenanceRequest = () => (
    <section className='space-y-6'>
        <FeedbackState
            kind='empty'
            title='LOCAL ONLY — dedicated edit form not LIVE'
            description='Create via Add. List/view/add persist via /api/v1/ops/transport-driver-maintenance. This edit route is UI-only for this slice.'

        />
        <div className='flex justify-center'>
            <Link to='/driver/maintenance-request' className='bg-[#515DEF] text-white text-sm px-8 py-2 rounded-md'>
                Back to Maintenance Requests
            </Link>
        </div>
    </section>
)

export default EditMaintenanceRequest
