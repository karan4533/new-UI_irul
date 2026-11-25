import DriverRoutes from '../Routes/DriverRoutes'
import { IntegrationNotice } from '../Common/ui'
import AppShell from './AppShell'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const DriverLayout = () => {
    const live = isLiveApiEnabled()

    return (
        <AppShell roleKey='driver'>
            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live Driver workspace'
                    description='LIVE (driver-scoped): vehicle, route, stops, duties, boarding attendance, vehicle health, fuel and maintenance via /api/v1/ops/transport-*. BLOCKED: vehicle document upload. MOCK: communication/reports; GPS/Track Bus is DEMO elsewhere and not claimed LIVE here. Leave uses shared leave API. No fleet admin or finance.'
                />
            ) : null}
            <DriverRoutes />
        </AppShell>
    )
}

export default DriverLayout
