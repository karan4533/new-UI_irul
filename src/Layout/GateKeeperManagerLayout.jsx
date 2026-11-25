import GateKeeperManagerRoutes from '../Routes/GateKeeperManagerRoutes'
import { IntegrationNotice } from '../Common/ui'
import AppShell from './AppShell'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const GateKeeperManagerLayout = () => {
    const live = isLiveApiEnabled()

    return (
        <AppShell roleKey='gatekeepermanager'>
            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live Gate Keeper Manager workspace'
                    description='LIVE: duties, incidents, visitors, team attendance (/api/v1/ops/gate-*). FO student/hostel passes read-only. Announcements and received leave use shared FastAPI. FO write / finance / admin-users blocked. No mock seed lists.'
                />
            ) : null}
            <GateKeeperManagerRoutes />
        </AppShell>
    )
}

export default GateKeeperManagerLayout
