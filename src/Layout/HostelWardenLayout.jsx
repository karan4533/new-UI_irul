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
                    description='Assignments and payments use FastAPI /api/v1/ops/hostel-assignments and hostel-payments. No dedicated blocks/rooms, outpass, visitors, mess, or check-in APIs. No finance collect or admin-user access.'
                />
            ) : null}
            <HostelWardenRoutes />
        </AppShell>
    )
}

export default HostelWardenLayout
