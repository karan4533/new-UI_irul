import FrontOfficeRecordsList from '../Components/FrontOfficeRecordsList'

const HostelGatePassList = () => (
    <FrontOfficeRecordsList
        collection='hostel-gate-passes'
        title='Hostel Gate Pass'
        description='Hostel gate passes recorded for boarders leaving and returning to campus.'
        addPath='/front-office/add-hostel-gate-pass'
        viewPathPrefix='/front-office/hostel-gate-pass/view'
        searchKeys={['id', 'studentName', 'hostelName', 'reason', 'status']}
        columns={[
            { key: 'id', label: 'Pass ID' },
            { key: 'studentName', label: 'Student' },
            { key: 'hostelName', label: 'Hostel' },
            { key: 'reason', label: 'Reason' },
            { key: 'date', label: 'Date' },
            { key: 'status', label: 'Status' },
        ]}
    />
)

export default HostelGatePassList
