import React, { useEffect, useState } from 'react'
import AttendanceAndLeaveWorkspace from '../../../Common/AttendanceAndLeave/AttendanceAndLeaveWorkspace'
import MyLeaveRequestsList from '../../../Common/LeaveRequest/MyLeaveRequestsList'
import ReceivedLeaveRequestsList from '../../../Common/LeaveRequest/ReceivedLeaveRequestsList'
import StudentsAttendanceList from '../../SuperAdmin/Attendance/Students/StudentsList'
import LiveEmployeeAttendance from './Employees/LiveEmployeeAttendance'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'

const TABS = [
    { id: 'students', label: 'Student attendance' },
    { id: 'employees', label: 'Employee attendance' },
    { id: 'received', label: 'Leave requests received' },
    { id: 'my-leaves', label: 'My leave requests' },
]

const INITIAL_TAB = { overview: 'students', records: 'employees', 'my-leaves': 'my-leaves' }

/**
 * Admin Attendance & Leave.
 * Live mode (VITE_USE_MOCK=false): FastAPI-backed student attendance, HR employee attendance and leave requests.
 * Mock mode: the browser-stored demo workspace.
 */
const AdminAttendanceAndLeave = ({ defaultTab = 'overview' }) => {
    const live = isLiveApiEnabled()
    const [tab, setTab] = useState(INITIAL_TAB[defaultTab] || 'students')

    useEffect(() => {
        setTab(INITIAL_TAB[defaultTab] || 'students')
    }, [defaultTab])

    if (!live) return <AttendanceAndLeaveWorkspace defaultTab={defaultTab} />

    return (
        <section className='space-y-4'>
            <div className='flex gap-2 overflow-x-auto border-b border-[var(--erp-line)]' role='tablist' aria-label='Attendance and leave views'>
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        type='button'
                        role='tab'
                        aria-selected={tab === item.id}
                        onClick={() => setTab(item.id)}
                        className={`min-h-11 whitespace-nowrap border-b-2 px-3 text-sm font-semibold cursor-pointer ${tab === item.id ? 'border-[var(--erp-indigo)] text-[var(--erp-indigo)]' : 'border-transparent text-[var(--erp-slate)]'}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            {tab === 'students' ? <StudentsAttendanceList /> : null}
            {tab === 'employees' ? <LiveEmployeeAttendance /> : null}
            {tab === 'received' ? (
                <ReceivedLeaveRequestsList roleKey='admin' description='Leave requests submitted to Admin for approval.' />
            ) : null}
            {tab === 'my-leaves' ? <MyLeaveRequestsList roleKey='admin' /> : null}
        </section>
    )
}

export default AdminAttendanceAndLeave
