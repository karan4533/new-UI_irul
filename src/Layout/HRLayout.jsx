import HRRoutes from '../Routes/HRRoutes'
import { useLocation } from 'react-router-dom'
import FinancialContextBar from '../Common/Finance/FinancialContextBar'
import { IntegrationNotice } from '../Common/ui'
import AppShell from './AppShell'
import { isLiveApiEnabled } from '../services/api/tokenStore'

const HRLayout = () => {
    const { pathname } = useLocation()
    const isPayroll = pathname.startsWith('/hr/payroll')
    const live = isLiveApiEnabled()

    return (
        <AppShell roleKey='hr'>
            {isPayroll ? (
                <FinancialContextBar
                    label='Payroll processing context'
                    period='September 2026'
                    lockState='Open'
                    source={live ? 'Live HR payroll API (/api/v1/hr/payroll*)' : 'Browser-stored HR and payroll records'}
                    integration={live ? 'API ledger (bank transfer disconnected)' : 'Disconnected'}
                />
            ) : (
                <IntegrationNotice
                    state={live ? 'connected' : 'demo'}
                    title={live ? 'Live HR workspace' : 'Browser-stored HR workspace'}
                    description={
                        live
                            ? 'Employees, leave, attendance, recruitment, documents, performance, and payroll collections use the FastAPI HR APIs when this page is wired. Enterprise Attendance & Leave workspace and dashboard charts may still be demo. Bank payment rails remain disconnected.'
                            : 'HR records and workflow changes in this frontend are local demonstration data. Set VITE_USE_MOCK=false and VITE_API_BASE_URL to use the campus API.'
                    }
                />
            )}
            <HRRoutes />
        </AppShell>
    )
}

export default HRLayout

