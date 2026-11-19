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
                    description='Drivers, vehicles, routes, student assignments and duties use FastAPI /api/v1/ops/transport-*. GPS/ProTrack track UI, NOC and fake /api/v1/transport/* paths are not LIVE. No admin-user management.'
                />
            ) : null}
            <TransportManagerRoutes />
        </AppShell>
    )
}

export default TransportManagerLayout
