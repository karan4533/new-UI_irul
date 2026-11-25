import React from 'react'
import { NavLink } from 'react-router-dom'
import { FeedbackState } from '../../Common/ui'

/** Live-mode placeholder for Admin demo-only screens with no approved backend domain. */
const DemoUnavailable = ({
    title = 'Not available in live mode',
    description = 'This Admin screen was demo-only. Use the live campus modules instead.',
    links = [{ to: '/admin/dashboard', label: 'Back to Admin dashboard' }],
}) => (
    <section className='space-y-4'>
        <FeedbackState
            kind='empty'
            title={title}
            description={description}
            action={(
                <div className='flex flex-wrap justify-center gap-3'>
                    {links.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className='rounded-md bg-[#515DEF] px-4 py-2 text-sm font-semibold text-white'
                        >
                            {link.label}
                        </NavLink>
                    ))}
                </div>
            )}
        />
    </section>
)

export default DemoUnavailable
