import { useEffect, useState } from 'react'
import OperationalBriefing from '../../../Common/Governance/OperationalBriefing'
import { FeedbackState } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { getAdminDashboard } from '../../../services/api/adminDashboardApiService'

const fallbackMetrics = [
    { label: 'Open admissions', value: '18', context: '6 awaiting document checks', icon: 'people', to: '/admin/front-office/admission-list' },
    { label: 'Pending approvals', value: '9', context: '3 due before end of day', icon: 'approvals', to: '/admin/leave-request/received' },
    { label: 'Attendance exceptions', value: '14', context: 'Students and employees combined', icon: 'risk', to: '/admin/attendance/student' },
    { label: 'Documents incomplete', value: '22', context: 'Across active student records', icon: 'documents', to: '/admin/students/student-details' },
]

const queues = [
    { title: 'Admission document verification', description: 'Review identity, guardian and prior-school evidence.', owner: 'Administration', sla: 'Today', status: 'Pending', to: '/admin/front-office/admission-list' },
    { title: 'Transfer certificate approvals', description: 'Validate clearance status before issuing certificates.', owner: 'Administrator', sla: '24 hours', status: 'In review', to: '/admin/tc-request-approval' },
    { title: 'Received leave decisions', description: 'Resolve requests waiting for an administrative decision.', owner: 'Administrator', sla: 'Today', status: 'Pending', to: '/admin/leave-request/received' },
]

const quickActions = [
    { label: 'Review admission enquiries', to: '/admin/front-office/admission-enquiry' },
    { label: 'Create a staff account', to: '/admin/rbac/user-creation/add' },
    { label: 'Manage role access', to: '/admin/rbac/roles' },
    { label: 'Assign a task', to: '/admin/task-management/assign-tasks/add' },
]

const Dashboard = () => {
    const live = isLiveApiEnabled()
    const [liveKpis, setLiveKpis] = useState(null)
    const [loading, setLoading] = useState(Boolean(live))
    const [error, setError] = useState('')

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setLoading(false)
            return
        }
        let cancelled = false
        ;(async () => {
            setLoading(true)
            setError('')
            const res = await getAdminDashboard()
            if (cancelled) return
            setLoading(false)
            if (!res.success) {
                setError(typeof res.error === 'string' ? res.error : 'Dashboard API unavailable.')
                setLiveKpis(null)
                return
            }
            setLiveKpis(res.data)
        })()
        return () => { cancelled = true }
    }, [])

    const metrics = liveKpis
        ? [
            { label: 'Students', value: String(liveKpis.students), context: `As of ${liveKpis.asOf || 'today'}`, icon: 'people', to: '/admin/user-management/student-database' },
            { label: 'Employees', value: String(liveKpis.employees), context: 'Campus HR directory', icon: 'approvals', to: '/admin/user-management/employee-database' },
            { label: 'Open escalations', value: String(liveKpis.openEscalations), context: 'Escalation inbox', icon: 'risk', to: '/admin/escalation-management' },
            { label: 'Unread notifications', value: String(liveKpis.unreadNotifications), context: `${liveKpis.announcementsThisMonth} announcements this month`, icon: 'documents', to: '/admin/notifications' },
        ]
        : fallbackMetrics

    return (
        <section className='space-y-4'>
            {live ? (
                <div className='rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3'>
                    <p className='text-xs font-semibold uppercase tracking-wide text-emerald-800'>
                        Live campus KPIs · GET /api/v1/admin/dashboard
                    </p>
                    {loading ? (
                        <div className='mt-2'><FeedbackState kind='loading' title='Loading KPIs' description='Fetching admin dashboard…' /></div>
                    ) : error ? (
                        <div className='mt-2'><FeedbackState kind='error' title='Dashboard API unavailable' description={error} /></div>
                    ) : (
                        <p className='mt-1 text-xs text-slate-600'>Queues below remain demo until those Admin workflows are wired.</p>
                    )}
                </div>
            ) : null}
            <OperationalBriefing
                title='Administration briefing'
                description='A focused view of admissions, records, approvals and access-control work that needs attention.'
                roleContext='Administrator workspace'
                metrics={metrics}
                queues={queues}
                quickActions={quickActions}
            />
        </section>
    )
}

export default Dashboard
