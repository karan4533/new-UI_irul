import FrontOfficeRecordsList from '../Components/FrontOfficeRecordsList'

const StudentReEnrollmentList = () => (
    <FrontOfficeRecordsList
        collection='student-re-enrollments'
        title='Student Re-Enrollment'
        description='Campus re-enrollment records from the Front Office API. Add/edit forms remain local until mapped field-by-field.'
        addPath='/front-office/student-re-enrollment/add'
        viewPathPrefix='/front-office/student-re-enrollment/view'
        searchKeys={['id', 'studentName', 'admissionNumber', 'tcNumber', 'status']}
        columns={[
            { key: 'id', label: 'ID' },
            { key: 'studentName', label: 'Student' },
            { key: 'admissionNumber', label: 'Admission No' },
            { key: 'tcNumber', label: 'TC Number' },
            { key: 'status', label: 'Status' },
        ]}
    />
)

export default StudentReEnrollmentList
