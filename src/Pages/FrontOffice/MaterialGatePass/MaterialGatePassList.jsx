import FrontOfficeRecordsList from '../Components/FrontOfficeRecordsList'

const MaterialGatePassList = () => (
    <FrontOfficeRecordsList
        collection='material-gate-passes'
        title='Material Gate Pass'
        description='Material gate passes for campus equipment and supplies movement.'
        addPath='/front-office/add-material-gate-pass'
        viewPathPrefix='/front-office/material-gate-pass/view'
        searchKeys={['id', 'requestedBy', 'purpose', 'status']}
        columns={[
            { key: 'id', label: 'Pass ID' },
            { key: 'requestedBy', label: 'Requested By' },
            { key: 'purpose', label: 'Purpose' },
            { key: 'date', label: 'Date' },
            { key: 'status', label: 'Status' },
        ]}
    />
)

export default MaterialGatePassList
