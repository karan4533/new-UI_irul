import FrontOfficeRecordsList from '../Components/FrontOfficeRecordsList'

const StudentTransfer = () => (
    <FrontOfficeRecordsList
        collection='student-transfers'
        title='Student Transfer List'
        description='Campus student transfer records.'
        addPath='/front-office/student-transfer/add'
        searchKeys={['id', 'studentName', 'admissionNumber', 'transferTo', 'status']}
        columns={[
            { key: 'id', label: 'ID' },
            { key: 'studentName', label: 'Student' },
            { key: 'admissionNumber', label: 'Admission No' },
            { key: 'transferTo', label: 'Transfer To' },
            { key: 'status', label: 'Status' },
            { key: 'date', label: 'Date' },
        ]}
    />
)

export default StudentTransfer
