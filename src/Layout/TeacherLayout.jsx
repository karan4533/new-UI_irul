import TeacherRoutes from '../Routes/TeacherRoutes'
import { IntegrationNotice } from '../Common/ui'
import AppShell from './AppShell'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const TeacherLayout = () => {
    const live = isLiveApiEnabled()

    return (
        <AppShell roleKey='teacher'>
            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live Teacher workspace'
                    description='Assigned student roster, class attendance, my-leave, lesson plans and announcements use verified FastAPI endpoints. Exam create is blocked without exams.write; Star Ratings, Stores and Helpdesk remain browser mock.'
                />
            ) : null}
            <TeacherRoutes />
        </AppShell>
    )
}

export default TeacherLayout
