import React from 'react'
import { Navigate, Route, Routes as ReactRoutes } from 'react-router-dom'
import { EnterpriseOperationsRoutes } from './EnterpriseOperationsRoutes'
import AnnouncementListView from '../Common/Announcement/AnnouncementListView'
import ViewAnnouncementPage from '../Common/Announcement/ViewAnnouncementPage'
import MyLeaveRequestsList from '../Common/LeaveRequest/MyLeaveRequestsList'
import AddLeaveRequestForm from '../Common/LeaveRequest/AddLeaveRequestForm'
import ViewMyLeaveRequestPage from '../Common/LeaveRequest/ViewMyLeaveRequestPage'
import Dashboard from '../Pages/HostelWarden/Dashboard/Dashboard'
import AssignmentsPage from '../Pages/HostelWarden/Assignments/AssignmentsPage'
import PaymentsPage from '../Pages/HostelWarden/Payments/PaymentsPage'
import HostelUnsupportedPage from '../Pages/HostelWarden/HostelUnsupportedPage'

const HostelWardenRoutes = () => (
    <ReactRoutes>
        <Route path='/hostel-warden' element={<Navigate to='/hostel-warden/dashboard' replace />} />
        <Route path='/hostel-warden/dashboard' element={<Dashboard />} />
        <Route path='/hostel-warden/assignments' element={<AssignmentsPage />} />
        <Route path='/hostel-warden/payments' element={<PaymentsPage />} />
        <Route path='/hostel-warden/announcement' element={<AnnouncementListView roleKey='hostelwarden' />} />
        <Route path='/hostel-warden/announcement/view/:id' element={<ViewAnnouncementPage roleKey='hostelwarden' />} />
        <Route path='/hostel-warden/leave-request/my-requests' element={<MyLeaveRequestsList roleKey='hostelwarden' />} />
        <Route path='/hostel-warden/leave-request/my-requests/add' element={<AddLeaveRequestForm roleKey='hostelwarden' />} />
        <Route path='/hostel-warden/leave-request/my-requests/view/:id' element={<ViewMyLeaveRequestPage roleKey='hostelwarden' />} />
        {/* Room matrix / outpass / mess have no FastAPI domain — honest MOCK/BLOCKED page before enterprise stubs */}
        <Route path='/hostel-warden/hostel' element={<HostelUnsupportedPage />} />
        <Route path='/hostel-warden/hostel-management' element={<HostelUnsupportedPage />} />
        <Route path='/hostel-warden/hostel-management/:tab' element={<HostelUnsupportedPage />} />
        {EnterpriseOperationsRoutes({ basePath: '/hostel-warden', role: 'hostelwarden' })}
        <Route path='*' element={<Navigate to='/hostel-warden/dashboard' replace />} />
    </ReactRoutes>
)

export default HostelWardenRoutes
