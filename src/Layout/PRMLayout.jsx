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
                    description='Admissions enquiries, admissions list, students, teachers, TC forward/reject, and front-office collections use FastAPI. Visitors have no backend API. Announcements are read-only. No finance, HR write, or admin user management.'
                />
            ) : null}
            <FrontOfficeRoutes />
        </AppShell>
    )
}

export default PRMLayout
