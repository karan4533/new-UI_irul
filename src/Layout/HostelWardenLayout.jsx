import HostelWardenRoutes from '../Routes/HostelWardenRoutes'
import { IntegrationNotice } from '../Common/ui'
import AppShell from './AppShell'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const HostelWardenLayout = () => {
    const live = isLiveApiEnabled()

    return (
        <AppShell roleKey='hostelwarden'>
            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live Hostel Warden workspace'
                    description='LIVE: assignments + payments dues register via /api/v1/ops/hostel-assignments and hostel-payments; announcements read; my leave. BLOCKED/MOCK: room master, bed availability, outpass, visitors, mess, complaints, maintenance, payment gateway. No finance collect or admin-user access.'
                />
            ) : null}
            <HostelWardenRoutes />
        </AppShell>
    )
}

export default HostelWardenLayout
