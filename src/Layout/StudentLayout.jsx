import { useEffect, useState } from 'react'
import StudentRoutes from '../Routes/StudentRoutes'
import { ActiveStudentProvider } from '../context/ActiveStudentContext'
import { DEFAULT_STUDENT_PROFILE } from '../Pages/Student/studentPortalConfig'
import AppShell from './AppShell'
import { IntegrationNotice } from '../Common/ui'
import { isLiveApiEnabled } from '../services/api/tokenStore'
import { getMyStudent } from '../services/api/studentApiService'

const StudentLayout = () => {
    const live = isLiveApiEnabled()
    const [student, setStudent] = useState(live ? null : DEFAULT_STUDENT_PROFILE)
    const [identitySource, setIdentitySource] = useState(live ? 'loading' : 'local')
    const [identityError, setIdentityError] = useState('')

    useEffect(() => {
        if (!live) {
            setStudent(DEFAULT_STUDENT_PROFILE)
            setIdentitySource('local')
            return undefined
        }
        let cancelled = false
        ;(async () => {
            const res = await getMyStudent()
            if (cancelled) return
            if (res.success && res.data?.id) {
                setStudent({
                    ...DEFAULT_STUDENT_PROFILE,
                    ...res.data,
                    id: res.data.id,
                    uuid: res.data.id,
                    backendId: res.data.id,
                })
                setIdentitySource('backend')
                setIdentityError('')
                return
            }
            setStudent(DEFAULT_STUDENT_PROFILE)
            setIdentitySource('error')
            setIdentityError(
                typeof res.error === 'string'
                    ? res.error
                    : 'No student profile is linked to this login (GET /api/v1/students/me).',
            )
        })()
        return () => {
            cancelled = true
        }
    }, [live])

    if (live && identitySource === 'loading') {
        return (
            <AppShell roleKey='student'>
                <IntegrationNotice
                    state='connected'
                    title='Loading student identity'
                    description='Resolving linked profile from GET /api/v1/students/me…'
                />
            </AppShell>
        )
    }

    return (
        <ActiveStudentProvider student={student || DEFAULT_STUDENT_PROFILE} portalMode='student' routePrefix='/student'>
            <AppShell roleKey='student'>
                {identitySource === 'backend' ? (
                    <IntegrationNotice
                        state='connected'
                        title='Live Student portal'
                        description={`Identity from GET /api/v1/students/me (${student?.admissionNumber || student?.id}). LIVE: fees, TC, announcements, calendar, attendance (UUID calendar), escalations. MOCK: Home Fun, Star Ratings, Track Bus, hostel/transport payments, dashboard KPIs.`}
                    />
                ) : identitySource === 'error' ? (
                    <IntegrationNotice
                        state='failed'
                        title='Student identity not linked'
                        description={`${identityError} Portal defaults are shown for layout only — fees/TC still use the authenticated student scope when the API allows.`}
                    />
                ) : null}
                <StudentRoutes />
            </AppShell>
        </ActiveStudentProvider>
    )
}

export default StudentLayout
