import React from 'react'
import { NavLink } from 'react-router-dom'
import { FeedbackState, IntegrationNotice } from '../../Common/ui'

/**
 * Deep-link target for gate registers / handover / vendors / team-attendance / invent-prone demos.
 * Existing ops collections for those names are not Phase-2 product SoT — do not invent LIVE claims.
 */
const GateUnsupportedPage = ({
    homeTo = '/gate-keeper/dashboard',
    liveLinks = [
        { to: '/gate-keeper/visitors', label: 'Open LIVE visitors' },
        { to: '/gate-keeper/my-duty', label: 'Open LIVE my duty' },
        { to: '/gate-keeper/incidents', label: 'Open LIVE incidents' },
    ],
} = {}) => (
    <section className='space-y-6'>
        <IntegrationNotice
            state='mock'
            title='MOCK / BLOCKED — registers, handover, vendors, team attendance, enterprise demos'
            description='Phase 2 Gate Keeper core SoT is /api/v1/ops/gate-visitors, gate-duties and gate-incidents, plus read-only FO *-gate-passes. Register / handover / vendor / team-attendance deep links are not claimed LIVE.'
        />
        <FeedbackState
            kind='empty'
            title='Unsupported gate demonstration surfaces'
            description='These menus stay presentation-only until a dedicated product workflow is approved. FO student/hostel/material gate-pass writes remain PRM/admin only (403 for gate roles).'
        />
        <div className='flex flex-wrap gap-3'>
            {liveLinks.map((link) => (
                <NavLink
                    key={link.to}
                    to={link.to}
                    className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md'
                >
                    {link.label}
                </NavLink>
            ))}
            <NavLink to={homeTo} className='text-sm text-[#515DEF] underline px-2 py-2'>
                Back to dashboard
            </NavLink>
        </div>
    </section>
)

export default GateUnsupportedPage
