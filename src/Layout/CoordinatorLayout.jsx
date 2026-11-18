import CoordinatorRoutes from '../Routes/CoordinatorRoutes'
import { IntegrationNotice } from '../Common/ui'
import AppShell from './AppShell'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const CoordinatorLayout = () => {
    const live = isLiveApiEnabled()

    return (
        <AppShell roleKey='coordinator'>
            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live Coordinator workspace'
                    description='Grade-band students, class attendance, my-leave, received leave (leave.decide), announcements, and section placement use verified FastAPI endpoints. Exams.write / lesson-plan approval APIs exist but most exam/timetable UIs remain demonstration until fully wired. No finance or admin-user access.'
                />
            ) : null}
            <CoordinatorRoutes />
        </AppShell>
    )
}

export default CoordinatorLayout
