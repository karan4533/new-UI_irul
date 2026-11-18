import ReceivedLeaveRequestsList from '../../../Common/LeaveRequest/ReceivedLeaveRequestsList'

export default function ReceivedLeaveRequests() {
    return (
        <ReceivedLeaveRequestsList
            roleKey='hr'
            description='Leave requests awaiting HR decision in the formal approval chain (campus leave-requests API).'
        />
    )
}
