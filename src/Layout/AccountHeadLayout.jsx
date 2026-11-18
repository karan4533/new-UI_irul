import AccountHeadRoutes from '../Routes/AccountHeadRoutes'
import FinancialContextBar from '../Common/Finance/FinancialContextBar'
import { IntegrationNotice } from '../Common/ui'
import AppShell from './AppShell'
import { isLiveApiEnabled } from '../services/api/tokenStore'
import { useFinance } from '../Pages/AccountHead/financeDomain/FinanceContext'

const AccountHeadLayout = () => {
    const live = isLiveApiEnabled()
    const { financePersistence, liveError, rehydrateFromApi } = useFinance()

    return (
        <AppShell roleKey='accounthead'>
            <FinancialContextBar
                period='September 2026'
                lockState='Open'
                source={live ? 'Live finance snapshot (/api/v1/finance/state)' : 'Browser-stored finance ledger'}
                integration={live ? 'API ledger (gateway/bank rails stubbed)' : 'Disconnected'}
            />
            {live ? (
                <IntegrationNotice
                    state={liveError || financePersistence?.liveSource === 'error' ? 'failed' : 'connected'}
                    title={liveError ? 'Finance API unavailable' : 'Live Finance workspace'}
                    description={
                        liveError
                            || 'Fees, collections, accounting books, wallets and transport finance collections hydrate from GET/PUT /api/v1/finance/state. Fee collect uses POST /finance/actions/collect-payment. Gateway/WhatsApp may queue as stubs.'
                    }
                    action={liveError ? (
                        <button type='button' className='text-sm font-semibold underline' onClick={() => rehydrateFromApi?.()}>
                            Retry
                        </button>
                    ) : null}
                />
            ) : null}
            <AccountHeadRoutes />
        </AppShell>
    )
}

export default AccountHeadLayout
