import FrontOfficeRecordsList from '../Components/FrontOfficeRecordsList'

const StudentTransfer = () => (
    <FrontOfficeRecordsList
        collection='student-transfers'
        title='Student Transfer List'
        description='Campus student transfer records from the Front Office API. Add form remains local until mapped field-by-field.'
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
