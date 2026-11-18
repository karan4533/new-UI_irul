import PrincipalRoutes from '../Routes/PrincipalRoutes'
import { IntegrationNotice } from '../Common/ui'
import AppShell from './AppShell'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const PrincipalLayout = () => {
    const live = isLiveApiEnabled()

    return (
        <AppShell roleKey='principal'>
            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live Principal workspace'
                    description='Students, teacher directory, announcements and received leave use verified FastAPI endpoints when signed in. Academic dashboard charts, timetable/teacher allocation localStorage, Home Fun and most enterprise ops remain demonstration until dedicated APIs are wired.'
                />
            ) : null}
            <PrincipalRoutes />
        </AppShell>
    )
}

export default PrincipalLayout
