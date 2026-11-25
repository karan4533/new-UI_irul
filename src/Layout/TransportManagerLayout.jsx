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
                    description='LIVE: drivers, vehicles, routes, student assignments, duties, maintenance, expenses, ProTrack365 Track Bus (/api/v1/ops/transport-* + /api/v1/protrack). Remaining mock: budget helper / NOC where no API exists.'
                />
            ) : null}
            <TransportManagerRoutes />
        </AppShell>
    )
}

export default TransportManagerLayout
