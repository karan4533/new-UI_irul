import AttendanceAndLeaveWorkspace from '../Common/AttendanceAndLeave/AttendanceAndLeaveWorkspace'
import MyLeaveRequestsList from '../Common/LeaveRequest/MyLeaveRequestsList'
import ReceivedLeaveRequestsList from '../Common/LeaveRequest/ReceivedLeaveRequestsList'
import LiveCollectionTabs from '../Pages/Admin/Live/LiveCollectionTabs'
import { EnterpriseOperationsRoutes } from './EnterpriseOperationsRoutes'
import React from 'react'
import { Navigate, Route, Routes as ReactRoutes, useParams } from 'react-router-dom'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const GATE_MGR_ATTENDANCE_TABS = [
    { id: 'team', label: 'Team attendance', collection: 'ops:gate-team-attendance' },
    { id: 'duties', label: 'Duty assignments', collection: 'ops:gate-duty-assignments' },
    { id: 'biometric', label: 'Biometric punches', collection: 'ops:biometric-attendance' },
]
import Dashboard from '../Pages/GateKeeperManager/Dashboard/Dashboard'
import AssignDutyList from '../Pages/GateKeeperManager/AssignDuty/AssignDutyList'
import AssignDuty from '../Pages/GateKeeperManager/AssignDuty/AssignDuty'
import AddLeaveRequest from '../Pages/GateKeeperManager/LeaveRequest/AddLeaveRequest'
import ViewMyLeaveRequest from '../Pages/GateKeeperManager/LeaveRequest/ViewMyLeaveRequest'
import ViewReceivedLeaveRequest from '../Pages/GateKeeperManager/LeaveRequest/ViewReceivedLeaveRequest'
import IncidentsList from '../Pages/GateKeeperManager/IncidentManagement/IncidentsList'
import GatekeeperAnnouncementList from '../Pages/GateKeeperManager/GatekeeperAnnouncement/GatekeeperAnnouncementList'
import AddGatekeeperAnnouncement from '../Pages/GateKeeperManager/GatekeeperAnnouncement/AddGatekeeperAnnouncement'
import ViewGatekeeperAnnouncement from '../Pages/GateKeeperManager/GatekeeperAnnouncement/ViewGatekeeperAnnouncement'
import EscalationList from '../Pages/GateKeeperManager/EscalationManagement/EscalationList'
import AddEscalation from '../Pages/GateKeeperManager/EscalationManagement/AddEscalation'
import ViewEscalation from '../Pages/GateKeeperManager/EscalationManagement/ViewEscalation'
import CommunicationInbox from '../Pages/GateKeeperManager/Communication/Inbox'
import RedirectLegacyDirectMessages from '../Common/Communication/RedirectLegacyDirectMessages'
import AcademicCalendar from '../Pages/GateKeeperManager/AcademicCalendar/AcademicCalendar'
import GatekeepersAttendance from '../Pages/GateKeeperManager/Attendance/GatekeepersAttendance'
import Notifications from '../Pages/GateKeeperManager/Notifications/Notifications'
import { TaskManagementRoutes } from '../Common/TaskManagement/TaskManagementRoutes'

const LegacyLeaveApprovalViewRedirect = () => {
    const { id } = useParams()
    return <Navigate to={`/gatekeeper-manager/leave-request/received/view/${id}`} replace />
}

const GateKeeperManagerRoutes = () => {
    const live = isLiveApiEnabled()
    return (
        <ReactRoutes>
            <Route path="/gatekeeper-manager/dashboard" element={<Dashboard />} />
            <Route path="/gatekeeper-manager/assign-duty-list" element={<AssignDutyList />} />
            <Route path="/gatekeeper-manager/assign-duty" element={<AssignDuty />} />
            <Route path="/gatekeeper-manager/leave-request" element={<Navigate to="/gatekeeper-manager/leave-request/my-requests" replace />} />
            <Route path="/gatekeeper-manager/leave-request/my-requests" element={live ? <MyLeaveRequestsList roleKey='gatekeepermanager' /> : <AttendanceAndLeaveWorkspace defaultTab="my-leaves" />} />
            <Route path="/gatekeeper-manager/leave-request/my-requests/add" element={<AddLeaveRequest />} />
            <Route path="/gatekeeper-manager/leave-request/my-requests/view/:id" element={<ViewMyLeaveRequest />} />
            <Route path="/gatekeeper-manager/leave-request/received" element={live ? <ReceivedLeaveRequestsList roleKey='gatekeepermanager' description='Leave requests submitted for Gatekeeper Manager approval.' /> : <AttendanceAndLeaveWorkspace defaultTab="received-leaves" />} />
            <Route path="/gatekeeper-manager/leave-request/received/view/:id" element={<ViewReceivedLeaveRequest />} />
            <Route path="/gatekeeper-manager/leave-approval-list" element={<Navigate to="/gatekeeper-manager/leave-request/received" replace />} />
            <Route path="/gatekeeper-manager/leave-approval-list/view/:id" element={<LegacyLeaveApprovalViewRedirect />} />
            <Route path="/gatekeeper-manager/incidents-list" element={<IncidentsList />} />
            <Route path="/gatekeeper-manager/gatekeeper-broadcast-list" element={<GatekeeperAnnouncementList />} />
            <Route path="/gatekeeper-manager/add-gatekeeper-broadcast" element={<AddGatekeeperAnnouncement />} />
            <Route path="/gatekeeper-manager/gatekeeper-broadcast-list/view/:id" element={<ViewGatekeeperAnnouncement />} />
            <Route path="/gatekeeper-manager/attendance" element={<Navigate to="/gatekeeper-manager/attendance/my-attendance" replace />} />
            <Route
                path="/gatekeeper-manager/attendance-and-leave"
                element={live
                    ? <LiveCollectionTabs title='Gatekeeper attendance' description='Live team attendance, duty assignments and biometric punches.' tabs={GATE_MGR_ATTENDANCE_TABS} />
                    : <AttendanceAndLeaveWorkspace defaultTab="overview" />}
            />
            <Route
                path="/gatekeeper-manager/attendance/my-attendance"
                element={live
                    ? <LiveCollectionTabs title='My attendance' description='Live gate team attendance and biometric punches.' tabs={GATE_MGR_ATTENDANCE_TABS} />
                    : <AttendanceAndLeaveWorkspace defaultTab="records" />}
            />
            <Route
                path="/gatekeeper-manager/attendance/gatekeepers-attendance"
                element={live
                    ? <LiveCollectionTabs title='Gatekeepers attendance' description='Live team attendance register.' tabs={GATE_MGR_ATTENDANCE_TABS} defaultTab='team' />
                    : <GatekeepersAttendance />}
            />
            <Route path="/gatekeeper-manager/academic-calendar" element={<AcademicCalendar />} />
            <Route path="/gatekeeper-manager/notifications" element={<Notifications />} />
            {TaskManagementRoutes({ basePath: '/gatekeeper-manager' })}
            <Route path="/gatekeeper-manager/communication" element={<Navigate to="/gatekeeper-manager/communication/inbox" replace />} />
            <Route path="/gatekeeper-manager/communication/inbox" element={<CommunicationInbox />} />
            <Route path="/gatekeeper-manager/communication/inbox/:conversationId" element={<CommunicationInbox />} />
            <Route path="/gatekeeper-manager/communication/direct-messages" element={<RedirectLegacyDirectMessages inboxBase="/gatekeeper-manager/communication/inbox" />} />
            <Route path="/gatekeeper-manager/communication/direct-messages/:conversationId" element={<RedirectLegacyDirectMessages inboxBase="/gatekeeper-manager/communication/inbox" />} />
            <Route path="/gatekeeper-manager/escalation-management" element={<EscalationList />} />
            <Route path="/gatekeeper-manager/escalation-management/add-escalation" element={<AddEscalation />} />
            <Route path="/gatekeeper-manager/escalation-management/view/:id" element={<ViewEscalation />} />
            {/* Enterprise Functional Operations (Stores, Gate Pass, File Room, Ticketing, Monitoring, Lost & Found) */}
            {EnterpriseOperationsRoutes({ basePath: '/gatekeeper-manager', role: 'gatekeeper-manager' })}

            <Route path="*" element={<Navigate to="/gatekeeper-manager/dashboard" replace />} />
        </ReactRoutes>
    )
}

export default GateKeeperManagerRoutes
