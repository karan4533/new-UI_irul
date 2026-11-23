import FrontOfficeRoutes from '../Routes/FrontOfficeRoutes'
import AppShell from './AppShell'

const PRMLayout = () => (
    <AppShell roleKey='prm'>
        <FrontOfficeRoutes />
    </AppShell>
)

export default PRMLayout
