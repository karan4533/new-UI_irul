import React from 'react'
import { Navigate, Route, Routes as ReactRoutes } from 'react-router-dom'
import Dashboard from '../Pages/SuperAdmin/Dashboard/Dashboard'
import AnnouncementList from '../Pages/SuperAdmin/Announcement/AnnouncementList'
import AddAnnouncement from '../Pages/SuperAdmin/Announcement/AddAnnouncement'
import ViewAnnouncement from '../Pages/SuperAdmin/Announcement/ViewAnnouncement'
import ReceivedLeaveRequests from '../Pages/SuperAdmin/LeaveRequest/ReceivedLeaveRequests'
import ViewReceivedLeaveRequest from '../Pages/SuperAdmin/LeaveRequest/ViewReceivedLeaveRequest'
import Notifications from '../Pages/SuperAdmin/Notifications/Notifications'
import StudentsAttendanceList from '../Pages/SuperAdmin/Attendance/Students/StudentsList'
import StudentsList from '../Pages/SuperAdmin/UserManagement/StudentDatabase/StudentsList'
import ViewStudent from '../Pages/SuperAdmin/UserManagement/StudentDatabase/ViewStudent'
import EmployeesList from '../Pages/SuperAdmin/UserManagement/EmployeeDatabase/EmployeesList'
import ViewEmployee from '../Pages/SuperAdmin/UserManagement/EmployeeDatabase/ViewEmployee'
import GatePassList from '../Pages/SuperAdmin/GatePass/GatePassList'
import ViewGatePass from '../Pages/SuperAdmin/GatePass/ViewGatePass'
import ActivityLogList from '../Pages/SuperAdmin/ActivityLogs/ActivityLogList'
import ViewActivityLog from '../Pages/SuperAdmin/ActivityLogs/ViewActivityLog'
import TransportOverview from '../Pages/SuperAdmin/TransportOverview/TransportOverview'
import ApprovalsList from '../Pages/SuperAdmin/Approvals/ApprovalsList'
import ViewApproval from '../Pages/SuperAdmin/Approvals/ViewApproval'
import FinanceOverview from '../Pages/SuperAdmin/Finance/FinanceOverview'
import AdminUsersList from '../Pages/SuperAdmin/UserCreation/AdminUsersList'
import CreateAdminUser from '../Pages/SuperAdmin/UserCreation/CreateAdminUser'
import ViewAdminUser from '../Pages/SuperAdmin/UserCreation/ViewAdminUser'
import { EnterpriseOperationsRoutes } from './EnterpriseOperationsRoutes'

/**
 * Super Admin routes — SA-specific API pages first, then shared enterprise workspaces
 * wired to FastAPI (communication, tasks, escalations, ops collections, etc.).
 */
const SuperAdminRoutes = () => {
    return (
        <ReactRoutes>
            <Route path="/super-admin/dashboard" element={<Dashboard />} />

            <Route path="/super-admin/attendance" element={<Navigate to="/super-admin/attendance/students/list" replace />} />
            <Route path="/super-admin/attendance/students/list" element={<StudentsAttendanceList />} />
            <Route path="/super-admin/attendance-and-leave" element={<Navigate to="/super-admin/leave-request/received" replace />} />

            <Route path="/super-admin/user-database" element={<Navigate to="/super-admin/user-database/students" replace />} />
            <Route path="/super-admin/user-database/students" element={<StudentsList />} />
            <Route path="/super-admin/user-database/students/view/:id" element={<ViewStudent />} />
            <Route path="/super-admin/user-database/employees" element={<EmployeesList />} />
            <Route path="/super-admin/user-database/employees/view/:id" element={<ViewEmployee />} />

            <Route path="/super-admin/user-creation" element={<AdminUsersList />} />
            <Route path="/super-admin/user-creation/add" element={<CreateAdminUser />} />
            <Route path="/super-admin/user-creation/view/:id" element={<ViewAdminUser />} />

            <Route path="/super-admin/gate-pass" element={<GatePassList />} />
            <Route path="/super-admin/gate-pass/view/:id" element={<ViewGatePass />} />

            <Route path="/super-admin/transport-overview" element={<TransportOverview />} />

            <Route path="/super-admin/leave-request/received" element={<ReceivedLeaveRequests />} />
            <Route path="/super-admin/leave-request/received/view/:id" element={<ViewReceivedLeaveRequest />} />

            <Route path="/super-admin/approvals" element={<ApprovalsList />} />
            <Route path="/super-admin/approvals/view/:id" element={<ViewApproval />} />

            <Route path="/super-admin/finance" element={<Navigate to="/super-admin/finance/overview" replace />} />
            <Route path="/super-admin/finance/overview" element={<FinanceOverview />} />

            <Route path="/super-admin/announcement" element={<AnnouncementList />} />
            <Route path="/super-admin/announcement/add" element={<AddAnnouncement />} />
            <Route path="/super-admin/announcement/view/:id" element={<ViewAnnouncement />} />

            <Route path="/super-admin/notifications" element={<Notifications />} />

            <Route path="/super-admin/activity-logs" element={<Navigate to="/super-admin/activity-logs/audit-logs" replace />} />
            <Route path="/super-admin/activity-logs/audit-logs" element={<ActivityLogList logType="audit-logs" />} />
            <Route path="/super-admin/activity-logs/login-history" element={<ActivityLogList logType="login-history" />} />
            <Route path="/super-admin/activity-logs/failed-logins" element={<ActivityLogList logType="failed-logins" />} />
            <Route path="/super-admin/activity-logs/data-changes" element={<ActivityLogList logType="data-changes" />} />
            <Route path="/super-admin/activity-logs/deleted-records" element={<ActivityLogList logType="deleted-records" />} />
            <Route path="/super-admin/activity-logs/approval-actions" element={<ActivityLogList logType="approval-actions" />} />
            <Route path="/super-admin/activity-logs/view/:id" element={<ViewActivityLog />} />

            {EnterpriseOperationsRoutes({ basePath: '/super-admin', role: 'superadmin' })}
        </ReactRoutes>
    )
}

export default SuperAdminRoutes
