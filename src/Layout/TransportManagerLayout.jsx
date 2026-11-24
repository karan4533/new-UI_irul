import TransportManagerRoutes from '../Routes/TransportManagerRoutes'
import { IntegrationNotice } from '../Common/ui'
import AppShell from './AppShell'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const TransportManagerLayout = () => {
    const live = isLiveApiEnabled()

    return (
        <AppShell roleKey='transportmanager'>
            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live Transport Manager workspace'
                    description='LIVE: drivers, vehicles, routes, student assignments, duties, maintenance, expenses ledger, driver fuel/maintenance approvals (/api/v1/ops/transport-*). MOCK: GPS/ProTrack Track Bus, budget helper, NOC, fake /api/v1/transport/*. No admin-user management.'
                />
            ) : null}
            <TransportManagerRoutes />
        </AppShell>
    )
}

export default TransportManagerLayout
