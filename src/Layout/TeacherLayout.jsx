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
                    description='Assigned student roster, class attendance, my-leave and announcements use verified FastAPI endpoints. Lesson-plan / exams / timetable UIs remain demonstration until fully wired; teacher has no exams.write, leave.decide, finance, or admin-user access.'
                />
            ) : null}
            <TeacherRoutes />
        </AppShell>
    )
}

export default TeacherLayout
