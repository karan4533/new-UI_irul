import React from 'react'
import { Link } from 'react-router-dom'
import { FeedbackState } from '../../../../Common/ui'

const EditVehicleHealthStatus = () => (
    <section className='space-y-6'>
        <FeedbackState
            kind='empty'
            title='LOCAL ONLY — dedicated edit form not LIVE'
            description='Create via Add. List/view/add persist via /api/v1/ops/transport-vehicle-health. This edit route is UI-only for this slice.'

        />
        <div className='flex justify-center'>
            <Link to='/driver/vehicle-management/vehicle-health-status' className='bg-[#515DEF] text-white text-sm px-8 py-2 rounded-md'>
                Back to Vehicle Health
            </Link>
        </div>
    </section>
)

export default EditVehicleHealthStatus
