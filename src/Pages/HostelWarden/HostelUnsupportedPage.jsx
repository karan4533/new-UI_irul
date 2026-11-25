import React from 'react'
import { NavLink } from 'react-router-dom'
import { FeedbackState, IntegrationNotice } from '../../Common/ui'
import LiveCollectionTabs from '../Admin/Live/LiveCollectionTabs'
import { isLiveApiEnabled } from '../../services/api/tokenStore'

const HOSTEL_LIVE_TABS = [
    { id: 'assignments', label: 'Room assignments', collection: 'ops:hostel-assignments' },
    { id: 'payments', label: 'Hostel payments', collection: 'ops:hostel-payments' },
    { id: 'gate-passes', label: 'Hostel gate passes', collection: 'front-office:hostel-gate-passes' },
]

/**
 * Deep-link target for enterprise hostel matrix / outpass / mess routes under the warden portal.
 * Live mode: browse approved ops + FO collections. Mock mode: honest blocked notice.
 */
const HostelUnsupportedPage = () => {
    if (isLiveApiEnabled()) {
        return (
            <LiveCollectionTabs
                title='Hostel operations'
                description='Live hostel assignments, payment register, and hostel gate passes. Room matrix / mess / complaints have no separate FastAPI domain yet.'
                tabs={HOSTEL_LIVE_TABS}
            />
        )
    }

    return (
        <section className='space-y-6'>
            <IntegrationNotice
                state='mock'
                title='MOCK / BLOCKED — room matrix, outpass, visitors, mess, complaints, maintenance'
                description='No FastAPI /api/v1/hostel/* domain. Bed availability, movement registers and mess menus on this path are not server truth. Use LIVE Assignments and Payments via /api/v1/ops/hostel-assignments and hostel-payments.'
            />
            <FeedbackState
                kind='empty'
                title='Unsupported hostel domain surfaces'
                description='Room master, outpass, visitors, mess, complaints and maintenance have no approved backend collections. Payment gateway confirmation is also not available here — ops dues rows are a register only.'
            />
            <div className='flex flex-wrap gap-3'>
                <NavLink to='/hostel-warden/assignments' className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md'>
                    Open LIVE assignments
                </NavLink>
                <NavLink to='/hostel-warden/payments' className='bg-white text-[#515DEF] text-sm px-4 py-2 rounded-md border border-[#515DEF]'>
                    Open LIVE payments register
                </NavLink>
                <NavLink to='/hostel-warden/dashboard' className='text-sm text-[#515DEF] underline px-2 py-2'>
                    Back to dashboard
                </NavLink>
            </div>
        </section>
    )
}

export default HostelUnsupportedPage
