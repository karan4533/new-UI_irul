import ReceivedLeaveRequestsList from '../../../Common/LeaveRequest/ReceivedLeaveRequestsList'

export default function ReceivedLeaveRequests() {
    return (
        <ReceivedLeaveRequestsList
            roleKey='coordinator'
            description='Leave requests awaiting Coordinator approval (leave.decide).'
        />
    )
}
