import { Navigate, useLocation } from 'react-router-dom'
import ParentRoutes from '../Routes/ParentRoutes'
import { ActiveStudentProvider } from '../context/ActiveStudentContext'
import { ParentChildProvider, useParentChild } from '../context/ParentChildContext'
import ChildSelection from '../Pages/Parent/ChildSelection'
import {
    PARENT_DASHBOARD_ROUTE,
    PARENT_ROUTE_PREFIX,
    PARENT_SELECT_CHILD_ROUTE,
} from '../Pages/Parent/parentPortalConfig'
import AppShell from './AppShell'
import { IntegrationNotice } from '../Common/ui'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const LoadingPortal = ({ children }) => (
    <div className='flex min-h-screen items-center justify-center bg-[var(--erp-canvas)] px-6 text-sm text-[var(--erp-slate)]' role='status'>
        {children}
    </div>
)

const ParentLayoutShell = () => {
    const { activeStudent, initialized, identitySource, liveIdentityError } = useParentChild()

    if (!initialized) return <LoadingPortal>Loading guardian workspace…</LoadingPortal>
    if (!activeStudent) return <Navigate to={PARENT_SELECT_CHILD_ROUTE} replace />

    return (
        <ActiveStudentProvider
            student={activeStudent}
            portalMode='parent'
            routePrefix={PARENT_ROUTE_PREFIX}
        >
            <AppShell roleKey='parent'>
                <aside className='mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950'>
                    <p className='font-semibold'>Client rule: no separate parent login</p>
                    <p className='mt-1 text-xs text-amber-900'>
                        Parent access is via the student profile only. This /parent workspace is legacy compatibility.
                        Prefer the student portal created after Finance admission payment — new enrolments do not create parent logins.
                    </p>
                </aside>
                {isLiveApiEnabled() && identitySource === 'backend' ? (
                    <IntegrationNotice
                        state='connected'
                        title='Legacy parent workspace (live child link)'
                        description={`Child identity from GET /api/v1/parents/me/children (${activeStudent.admissionNumber || activeStudent.id}). Prefer student-profile access per client workflow.`}
                    />
                ) : null}
                {isLiveApiEnabled() && identitySource === 'error' ? (
                    <IntegrationNotice
                        state='failed'
                        title='Parent children unavailable'
                        description={liveIdentityError || 'GET /api/v1/parents/me/children failed. Temporary FE seed mapping is not used while live.'}
                    />
                ) : null}
                <ParentRoutes />
            </AppShell>
        </ActiveStudentProvider>
    )
}

const ParentSelectChildGate = () => {
    const { mappedChildren, activeStudentId, initialized } = useParentChild()

    if (!initialized) return <LoadingPortal>Loading guardian access…</LoadingPortal>

    if (mappedChildren.length === 1 && activeStudentId) {
        return <Navigate to={PARENT_DASHBOARD_ROUTE} replace />
    }

    return <ChildSelection />
}

const ParentLayout = () => {
    const location = useLocation()
    const isSelectChild = location.pathname === PARENT_SELECT_CHILD_ROUTE

    return (
        <ParentChildProvider>
            {isSelectChild ? <ParentSelectChildGate /> : <ParentLayoutShell />}
        </ParentChildProvider>
    )
}

export default ParentLayout

