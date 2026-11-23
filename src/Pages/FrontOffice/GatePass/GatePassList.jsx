import FrontOfficeRecordsList from '../Components/FrontOfficeRecordsList'

const GatePassList = () => (
    <FrontOfficeRecordsList
        collection='student-gate-passes'
        title='Student Gate Pass'
        description='Student gate passes recorded for campus exit and return.'
        addPath='/front-office/add-gate-pass'
        viewPathPrefix='/front-office/student-gate-pass/view'
        searchKeys={['id', 'studentName', 'studentId', 'classSection', 'reason', 'status']}
        columns={[
            { key: 'id', label: 'Pass ID' },
            { key: 'studentName', label: 'Student' },
            { key: 'classSection', label: 'Class' },
            { key: 'reason', label: 'Reason' },
            { key: 'date', label: 'Date' },
            { key: 'outTime', label: 'Out Time' },
            { key: 'status', label: 'Status' },
        ]}
    />
)

export default GatePassList
