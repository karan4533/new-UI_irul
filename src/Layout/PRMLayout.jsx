import FrontOfficeRoutes from '../Routes/FrontOfficeRoutes'
import { IntegrationNotice } from '../Common/ui'
import AppShell from './AppShell'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const PRMLayout = () => {
    const live = isLiveApiEnabled()

    return (
        <AppShell roleKey='prm'>
            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live Front Office (PRM) workspace'
                    description='Admissions, students, teachers, TC, FO collections, and Visitors (ops/gate-visitors) use FastAPI. Announcements are read-only. No finance, HR write, or admin user management.'
                />
            ) : null}
            <FrontOfficeRoutes />
        </AppShell>
    )
}

export default PRMLayout
