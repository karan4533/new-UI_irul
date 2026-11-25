import AttendanceAndLeaveWorkspace from '../Common/AttendanceAndLeave/AttendanceAndLeaveWorkspace'
import { EnterpriseOperationsRoutes } from './EnterpriseOperationsRoutes'
import { TaskManagementRoutes } from '../Common/TaskManagement/TaskManagementRoutes'
import React from 'react'
import CommunicationInbox from '../Pages/TransportManager/Communication/Inbox'
import RedirectLegacyDirectMessages from '../Common/Communication/RedirectLegacyDirectMessages'
import { Route, Routes as ReactRoutes, Navigate } from 'react-router-dom'
import { isLiveApiEnabled } from '../services/api/tokenStore'
import Dashboard from '../Pages/TransportManager/Dashboard/Dashboard'
import DriverManagement from '../Pages/TransportManager/DriverManagement/DriverManagement'
import AddDriver from '../Pages/TransportManager/DriverManagement/AddDriver'
import EditDriver from '../Pages/TransportManager/DriverManagement/EditDriver'
import ViewDriver from '../Pages/TransportManager/DriverManagement/ViewDriver'
import VehicleManagement from '../Pages/TransportManager/VehicleManagement/VehicleManagement'
import AddVehicle from '../Pages/TransportManager/VehicleManagement/AddVehicle'
import EditVehicle from '../Pages/TransportManager/VehicleManagement/EditVehicle'
import ViewVehicle from '../Pages/TransportManager/VehicleManagement/ViewVehicle'
import RouteManagement from '../Pages/TransportManager/RouteManagement/RouteManagement'
import AddRoute from '../Pages/TransportManager/RouteManagement/AddRoute'
import EditRoute from '../Pages/TransportManager/RouteManagement/EditRoute'
import ViewRoute from '../Pages/TransportManager/RouteManagement/ViewRoute'
import RouteData from '../Pages/TransportManager/RouteData/RouteData'
import TrackBus from '../Pages/TransportManager/RouteData/TrackBus'
import StudentTransport from '../Pages/TransportManager/StudentTransport/StudentTransport'
import AddStudentTransport from '../Pages/TransportManager/StudentTransport/AddStudentTransport'
import ViewStudentTransport from '../Pages/TransportManager/StudentTransport/ViewStudentTransport'
import AssignDuty from '../Pages/TransportManager/AssignDuty/AssignDuty'
import AddAssignDuty from '../Pages/TransportManager/AssignDuty/AddAssignDuty'
import ViewAssignDuty from '../Pages/TransportManager/AssignDuty/ViewAssignDuty'
import VehicleMaintenance from '../Pages/TransportManager/VehicleMaintenance/VehicleMaintenance'
import AddVehicleMaintenance from '../Pages/TransportManager/VehicleMaintenance/AddVehicleMaintenance'
import ViewVehicleMaintenance from '../Pages/TransportManager/VehicleMaintenance/ViewVehicleMaintenance'
import RequestApprovals from '../Pages/TransportManager/RequestApprovals/RequestApprovals'
import AddRequest from '../Pages/TransportManager/RequestApprovals/AddRequest'
import ViewRequest from '../Pages/TransportManager/RequestApprovals/ViewRequest'
import TransportExpenses from '../Pages/TransportManager/TransportExpenses/TransportExpenses'
import AddTransportExpense from '../Pages/TransportManager/TransportExpenses/AddTransportExpense'
import ViewTransportExpense from '../Pages/TransportManager/TransportExpenses/ViewTransportExpense'
import LeaveRequest from '../Pages/TransportManager/LeaveRequest/LeaveRequest'
import ViewLeaveRequest from '../Pages/TransportManager/LeaveRequest/ViewLeaveRequest'
import DriverConductorNoc from '../Pages/TransportManager/NocManagement/DriverConductorNoc'
import MyLeaveRequestsList from '../Common/LeaveRequest/MyLeaveRequestsList'
import AddLeaveRequestForm from '../Common/LeaveRequest/AddLeaveRequestForm'
import ViewMyLeaveRequestPage from '../Common/LeaveRequest/ViewMyLeaveRequestPage'
import AnnouncementListView from '../Common/Announcement/AnnouncementListView'
import ViewAnnouncementPage from '../Common/Announcement/ViewAnnouncementPage'

const TransportManagerRoutes = () => {
    const live = isLiveApiEnabled()
    return (
        <ReactRoutes>
            <Route path="/transport-manager/dashboard" element={<Dashboard />} />
            <Route path="/transport-manager/driver-management" element={<DriverManagement />} />
            <Route path="/transport-manager/driver-management/add" element={live ? <Navigate to="/transport-manager/driver-management" replace /> : <AddDriver />} />
            <Route path="/transport-manager/driver-management/edit/:id" element={live ? <Navigate to="/transport-manager/driver-management" replace /> : <EditDriver />} />
            <Route path="/transport-manager/driver-management/view/:id" element={live ? <Navigate to="/transport-manager/driver-management" replace /> : <ViewDriver />} />
            <Route path="/transport-manager/vehicle-management" element={<VehicleManagement />} />
            <Route path="/transport-manager/vehicle-management/add-vehicle" element={live ? <Navigate to="/transport-manager/vehicle-management" replace /> : <AddVehicle />} />
            <Route path="/transport-manager/vehicle-management/view/:id" element={live ? <Navigate to="/transport-manager/vehicle-management" replace /> : <ViewVehicle />} />
            <Route path="/transport-manager/vehicle-management/edit/:id" element={live ? <Navigate to="/transport-manager/vehicle-management" replace /> : <EditVehicle />} />
            <Route path="/transport-manager/route-management" element={<RouteManagement />} />
            <Route path="/transport-manager/route-management/add-route" element={live ? <Navigate to="/transport-manager/route-management" replace /> : <AddRoute />} />
            <Route path="/transport-manager/route-management/view/:id" element={live ? <Navigate to="/transport-manager/route-management" replace /> : <ViewRoute />} />
            <Route path="/transport-manager/route-management/edit/:id" element={live ? <Navigate to="/transport-manager/route-management" replace /> : <EditRoute />} />
            <Route path="/transport-manager/route-data" element={<RouteData />} />
            <Route path="/transport-manager/route-data/track/:id" element={<TrackBus />} />
            <Route path="/transport-manager/student-transport" element={<StudentTransport />} />
            <Route path="/transport-manager/student-transport/add" element={live ? <Navigate to="/transport-manager/student-transport" replace /> : <AddStudentTransport />} />
            <Route path="/transport-manager/student-transport/view/:id" element={live ? <Navigate to="/transport-manager/student-transport" replace /> : <ViewStudentTransport />} />
            <Route path="/transport-manager/assign-duty" element={<AssignDuty />} />
            <Route path="/transport-manager/assign-duty/add" element={live ? <Navigate to="/transport-manager/assign-duty" replace /> : <AddAssignDuty />} />
            <Route path="/transport-manager/assign-duty/view/:id" element={live ? <Navigate to="/transport-manager/assign-duty" replace /> : <ViewAssignDuty />} />
            <Route path="/transport-manager/vehicle-maintenance" element={<VehicleMaintenance />} />
            <Route path="/transport-manager/vehicle-maintenance/add" element={<AddVehicleMaintenance />} />
            <Route path="/transport-manager/vehicle-maintenance/view/:id" element={live ? <Navigate to="/transport-manager/vehicle-maintenance" replace /> : <ViewVehicleMaintenance />} />
            <Route path="/transport-manager/request-approvals" element={<RequestApprovals />} />
            <Route path="/transport-manager/request-approvals/add-request" element={live ? <Navigate to="/transport-manager/request-approvals" replace /> : <AddRequest />} />
            <Route path="/transport-manager/request-approvals/view-request/:id" element={live ? <Navigate to="/transport-manager/request-approvals" replace /> : <ViewRequest />} />
            <Route path="/transport-manager/transport-expenses" element={<TransportExpenses />} />
            <Route path="/transport-manager/transport-expenses/add/:type" element={<AddTransportExpense />} />
            <Route path="/transport-manager/transport-expenses/view/:type/:id" element={live ? <Navigate to="/transport-manager/transport-expenses" replace /> : <ViewTransportExpense />} />
            <Route path="/transport-manager/attendance-and-leave" element={live ? <Navigate to="/transport-manager/leave-request/my-requests" replace /> : <AttendanceAndLeaveWorkspace defaultTab="overview" />} />
            <Route path="/transport-manager/leave-request/my-requests" element={<MyLeaveRequestsList roleKey='transportmanager' />} />
            <Route path="/transport-manager/leave-request/my-requests/add" element={<AddLeaveRequestForm roleKey='transportmanager' />} />
            <Route path="/transport-manager/leave-request/my-requests/view/:id" element={<ViewMyLeaveRequestPage roleKey='transportmanager' />} />
            <Route path="/transport-manager/leave-request" element={live ? <Navigate to="/transport-manager/leave-request/my-requests" replace /> : <LeaveRequest />} />
            <Route path="/transport-manager/leave-request/view/:id" element={live ? <Navigate to="/transport-manager/leave-request/my-requests" replace /> : <ViewLeaveRequest />} />
            <Route path="/transport-manager/announcement" element={<AnnouncementListView roleKey='transportmanager' />} />
            <Route path="/transport-manager/announcement/view/:id" element={<ViewAnnouncementPage roleKey='transportmanager' />} />
            <Route path="/transport-manager/driver-conductor-noc" element={<DriverConductorNoc />} />
            {/* Communication */}
            <Route path="/transport-manager/communication" element={<Navigate to="/transport-manager/communication/inbox" replace />} />
            <Route path="/transport-manager/communication/inbox" element={<CommunicationInbox />} />
            <Route path="/transport-manager/communication/inbox/:conversationId" element={<CommunicationInbox />} />
            <Route path="/transport-manager/communication/direct-messages" element={<RedirectLegacyDirectMessages inboxBase="/transport-manager/communication/inbox" />} />
            <Route path="/transport-manager/communication/direct-messages/:conversationId" element={<RedirectLegacyDirectMessages inboxBase="/transport-manager/communication/inbox" />} />
            {/* Universal Task Management */}
            {TaskManagementRoutes({ basePath: '/transport-manager' })}

            {/* Enterprise Functional Operations (Stores, Gate Pass, File Room, Ticketing, Monitoring, Lost & Found) */}
            {EnterpriseOperationsRoutes({ basePath: '/transport-manager', role: 'transportmanager' })}

            <Route path="*" element={<Navigate to="/transport-manager/dashboard" replace />} />
        </ReactRoutes>
    )
}

export default TransportManagerRoutes
