import React from 'react'
import { Route, Routes as ReactRoutes, Navigate } from 'react-router-dom'
import AttendanceAndLeaveWorkspace from '../Common/AttendanceAndLeave/AttendanceAndLeaveWorkspace'
import MyLeaveRequestsList from '../Common/LeaveRequest/MyLeaveRequestsList'
import AddLeaveRequestForm from '../Common/LeaveRequest/AddLeaveRequestForm'
import ViewMyLeaveRequestPage from '../Common/LeaveRequest/ViewMyLeaveRequestPage'
import { EnterpriseOperationsRoutes } from './EnterpriseOperationsRoutes'
import VisitorsLive from '../Pages/Gatekeeper/Visitors/VisitorsLive'
import GateOpsCollectionLive from '../Pages/Gatekeeper/GateOpsCollectionLive'
import StudentGatePassesLive from '../Pages/Gatekeeper/StudentGatePassesLive'
import LiveCollectionTabs from '../Pages/Admin/Live/LiveCollectionTabs'
import Dashboard from '../Pages/Gatekeeper/Dashboard/Dashboard'
import HosteGatePass from '../Pages/Gatekeeper/HosteGatePass/HosteGatePass'
import MyDuty from '../Pages/Gatekeeper/MyDuty/MyDuty'
import Incidents from '../Pages/Gatekeeper/Incidents/Incidents'
import AddIncidents from '../Pages/Gatekeeper/Incidents/AddIncidents'
import ViewIncident from '../Pages/Gatekeeper/Incidents/ViewIncident'
import AnnouncementList from '../Pages/Gatekeeper/Announcement/AnnouncementList'
import ViewAnnouncement from '../Pages/Gatekeeper/Announcement/ViewAnnouncement'
import EscalationList from '../Pages/Gatekeeper/EscalationManagement/EscalationList'
import AddEscalation from '../Pages/Gatekeeper/EscalationManagement/AddEscalation'
import ViewEscalation from '../Pages/Gatekeeper/EscalationManagement/ViewEscalation'
import CommunicationInbox from '../Pages/Gatekeeper/Communication/Inbox'
import RedirectLegacyDirectMessages from '../Common/Communication/RedirectLegacyDirectMessages'
import AcademicCalendar from '../Pages/Gatekeeper/AcademicCalendar/AcademicCalendar'
import Notifications from '../Pages/Gatekeeper/Notifications/Notifications'
import { TaskManagementRoutes } from '../Common/TaskManagement/TaskManagementRoutes'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const GATE_ATTENDANCE_TABS = [
    { id: 'team', label: 'Team attendance', collection: 'ops:gate-team-attendance' },
    { id: 'duties', label: 'Duty roster', collection: 'ops:gate-duties' },
    { id: 'biometric', label: 'Biometric punches', collection: 'ops:biometric-attendance' },
]

const GateKeeperRoutes = () => {
    const live = isLiveApiEnabled()
    return (
        <ReactRoutes>
            <Route path="/gate-keeper/dashboard" element={<Dashboard />} />
            <Route path="/gate-keeper/hostel-gate-pass" element={<HosteGatePass />} />
            <Route path="/gate-keeper/my-duty" element={<MyDuty />} />
            <Route path="/gate-keeper/incidents" element={<Incidents />} />
            <Route path="/gate-keeper/add-incident" element={<AddIncidents />} />
            <Route path="/gate-keeper/incidents/:id" element={<ViewIncident />} />
            
            {/* Gate Pass & Security — all live ops / FO read; no mock workspace */}
            <Route path="/gate-keeper/visitors" element={<VisitorsLive />} />
            <Route path="/gate-keeper/gate-pass-list" element={<StudentGatePassesLive />} />
            <Route path="/gate-keeper/security-workspace" element={<VisitorsLive />} />
            <Route path="/gate-keeper/add-gate-pass" element={<StudentGatePassesLive />} />
            <Route path="/gate-keeper/registers" element={<GateOpsCollectionLive kind="registers" />} />
            <Route path="/gate-keeper/handover" element={<GateOpsCollectionLive kind="handover" />} />
            <Route path="/gate-keeper/vendors" element={<GateOpsCollectionLive kind="vendors" />} />

            <Route path="/gate-keeper/broadcast-list" element={<AnnouncementList />} />
            <Route path="/gate-keeper/view-broadcast/:id" element={<ViewAnnouncement />} />
            <Route path="/gate-keeper/attendance" element={<Navigate to="/gate-keeper/attendance/my-attendance" replace />} />
            <Route
                path="/gate-keeper/attendance-and-leave"
                element={live
                    ? <LiveCollectionTabs title='Gate attendance' description='Live team attendance, duties and biometric punches.' tabs={GATE_ATTENDANCE_TABS} />
                    : <AttendanceAndLeaveWorkspace defaultTab="overview" />}
            />
            <Route
                path="/gate-keeper/attendance/my-attendance"
                element={live
                    ? <LiveCollectionTabs title='My attendance' description='Live gate team attendance and biometric punches.' tabs={GATE_ATTENDANCE_TABS} />
                    : <AttendanceAndLeaveWorkspace defaultTab="records" />}
            />
            <Route path="/gate-keeper/leave-request" element={<Navigate to="/gate-keeper/leave-request/my-requests" replace />} />
            <Route path="/gate-keeper/leave-request/my-requests" element={live ? <MyLeaveRequestsList roleKey='gatekeeper' /> : <AttendanceAndLeaveWorkspace defaultTab="my-leaves" />} />
            <Route path="/gate-keeper/leave-request/my-requests/add" element={<AddLeaveRequestForm roleKey='gatekeeper' />} />
            <Route path="/gate-keeper/leave-request/my-requests/view/:id" element={<ViewMyLeaveRequestPage roleKey='gatekeeper' />} />
            <Route path="/gate-keeper/academic-calendar" element={<AcademicCalendar />} />
            <Route path="/gate-keeper/notifications" element={<Notifications />} />

            {/* Universal Task Management */}
            {TaskManagementRoutes({ basePath: '/gate-keeper' })}

            {/* Enterprise Functional Operations (Stores, Gate Pass, File Room, Ticketing, Monitoring, Lost & Found) */}
            {EnterpriseOperationsRoutes({ basePath: '/gate-keeper', role: 'gatekeeper' })}

            <Route path="/gate-keeper/communication" element={<Navigate to="/gate-keeper/communication/inbox" replace />} />
            <Route path="/gate-keeper/communication/inbox" element={<CommunicationInbox />} />
            <Route path="/gate-keeper/communication/inbox/:conversationId" element={<CommunicationInbox />} />
            <Route path="/gate-keeper/communication/direct-messages" element={<RedirectLegacyDirectMessages inboxBase="/gate-keeper/communication/inbox" />} />
            <Route path="/gate-keeper/communication/direct-messages/:conversationId" element={<RedirectLegacyDirectMessages inboxBase="/gate-keeper/communication/inbox" />} />
            <Route path="/gate-keeper/escalation-management" element={<EscalationList />} />
            <Route path="/gate-keeper/escalation-management/add-escalation" element={<AddEscalation />} />
            <Route path="/gate-keeper/escalation-management/view/:id" element={<ViewEscalation />} />
            <Route path="*" element={<Navigate to="/gate-keeper/dashboard" replace />} />
        </ReactRoutes>
    )
}

export default GateKeeperRoutes
