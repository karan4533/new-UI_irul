import GateKeeperRoutes from '../Routes/GateKeeperRoutes'
import { IntegrationNotice } from '../Common/ui'
import AppShell from './AppShell'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const GateKeeperLayout = () => {
    const live = isLiveApiEnabled()

    return (
        <AppShell roleKey='gatekeeper'>
            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live Gate Keeper workspace'
                    description='LIVE: visitors, duties, incidents, registers, handover, vendors (/api/v1/ops/gate-*). Student/hostel gate passes are read-only FO. FO write, finance and admin-users stay blocked. No mock workspace SoT.'
                />
            ) : null}
            <GateKeeperRoutes />
        </AppShell>
    )
}

export default GateKeeperLayout
