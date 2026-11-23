import FrontOfficeRecordsList from '../Components/FrontOfficeRecordsList'

const GoodsReceivedPassList = () => (
    <FrontOfficeRecordsList
        collection='goods-received-passes'
        title='Goods Received Pass'
        description='Goods received passes for inbound deliveries.'
        addPath='/front-office/add-goods-received-pass'
        viewPathPrefix='/front-office/goods-received-pass/view'
        searchKeys={['id', 'supplierName', 'invoiceNumber', 'status']}
        columns={[
            { key: 'id', label: 'Pass ID' },
            { key: 'supplierName', label: 'Supplier' },
            { key: 'invoiceNumber', label: 'Invoice' },
            { key: 'date', label: 'Date' },
            { key: 'status', label: 'Status' },
        ]}
    />
)

export default GoodsReceivedPassList
