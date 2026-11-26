import { useCallback, useEffect, useState } from 'react'
import { Download, Minus, Plus, RefreshCw, Wallet } from 'lucide-react'
import { IntegrationNotice, PageHeader } from '../../../Common/ui'
import WalletOverviewTab from './Components/WalletOverviewTab'
import UserWalletsTab from './Components/UserWalletsTab'
import RechargeRecordsTab from './Components/RechargeRecordsTab'
import SpendingHistoryTab from './Components/SpendingHistoryTab'
import RechargeOptionsTab from './Components/RechargeOptionsTab'
import RechargeWalletModal from './Components/RechargeWalletModal'
import { OpenWalletModal, SpendWalletModal } from './Components/WalletActionModals'
import { useFinance } from '../financeDomain/FinanceContext'
import { PAYMENT_MODES, SOURCE_MODULES } from '../financeDomain/financeConstants'
import {
    RECHARGE_RECORDS,
    USER_WALLETS,
    WALLET_ROLE_FILTERS,
    WALLET_TABS,
    formatRupeeAmount,
    parseRupeeAmount,
} from './walletManagementData'
import {
    buildLiveOverviewCards,
    buildLiveRechargeCards,
    buildLiveSpendCards,
    buildLiveWalletCards,
} from './walletLiveCards'
import {
    EMPTY_WALLET_DATA,
    listWalletsApi,
    openWalletApi,
    rechargeWalletApi,
    setWalletStatusApi,
    spendWalletApi,
} from '../../../services/api/walletApiService.js'
import { isLiveApiEnabled } from '../../../services/api/tokenStore.js'

const formatRechargeDateTime = () => {
    const now = new Date()
    return now.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    })
}

const primaryButton = 'inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white disabled:opacity-50'
const secondaryButton = 'inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-indigo)] bg-white px-4 text-sm font-semibold text-[var(--erp-indigo)] disabled:opacity-50'

const WalletManagement = () => {
    const { postExternalInflow, rehydrateFromApi } = useFinance()
    const live = isLiveApiEnabled()
    const [activeTab, setActiveTab] = useState('wallet-overview')
    const [roleFilter, setRoleFilter] = useState(WALLET_ROLE_FILTERS[0])
    const [rechargeModal, setRechargeModal] = useState(false)
    const [openModal, setOpenModal] = useState(false)
    const [spendModal, setSpendModal] = useState(false)
    const [userWallets, setUserWallets] = useState(live ? [] : USER_WALLETS)
    const [rechargeRecords, setRechargeRecords] = useState(live ? [] : RECHARGE_RECORDS)
    const [liveData, setLiveData] = useState(EMPTY_WALLET_DATA)
    const [loading, setLoading] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const refresh = useCallback(async () => {
        if (!live) return
        setLoading(true)
        setError('')
        const res = await listWalletsApi()
        if (!res.success) {
            setError(res.error || 'Could not load wallets.')
        } else {
            setLiveData(res.data)
        }
        setLoading(false)
    }, [live])

    useEffect(() => {
        refresh()
    }, [refresh])

    // After every mutation: reload the ledger and the shared finance snapshot so its debounced PUT never writes stale data.
    const afterAction = async (res, successMessage) => {
        setNotice(res.data?.skipped ? 'Already recorded — no duplicate created.' : successMessage)
        await refresh()
        if (typeof rehydrateFromApi === 'function') await rehydrateFromApi()
    }

    const runLive = async (call, successMessage) => {
        setBusy(true)
        setError('')
        setNotice('')
        const res = await call()
        setBusy(false)
        if (!res.success) return { success: false, message: res.error || 'Action failed.' }
        await afterAction(res, successMessage)
        return { success: true, message: successMessage }
    }

    const handleOfflineRecharge = ({ email, amount, mode, reference }) => {
        if (live) {
            return runLive(
                () => rechargeWalletApi({ email, amount, mode, reference }),
                `${formatRupeeAmount(amount)} credited to the wallet.`,
            )
        }
        const walletIndex = userWallets.findIndex(
            (wallet) => wallet.email.toLowerCase() === email.toLowerCase(),
        )

        if (walletIndex === -1) {
            return {
                success: false,
                message: 'No wallet found for this email ID. Please verify and try again.',
            }
        }

        const wallet = userWallets[walletIndex]
        const updatedBalance = parseRupeeAmount(wallet.balance) + amount
        const updatedWallet = {
            ...wallet,
            balance: formatRupeeAmount(updatedBalance),
            lastRecharge: formatRechargeDateTime().split(',')[0],
            status: updatedBalance > 0 && wallet.status === 'Zero Balance' ? 'Active' : wallet.status,
        }

        const newRecord = {
            id: `RCG-${Date.now().toString().slice(-5)}`,
            user: wallet.name,
            initials: wallet.initials,
            role: wallet.role,
            mode: 'Offline',
            amount: formatRupeeAmount(amount),
            dateTime: formatRechargeDateTime(),
            status: 'Success',
        }

        setUserWallets((prev) => prev.map((item, index) => (
            index === walletIndex ? updatedWallet : item
        )))
        setRechargeRecords((prev) => [newRecord, ...prev])
        postExternalInflow({
            amount,
            category: 'Wallet Recharge',
            paymentMode: PAYMENT_MODES.CASH,
            reference: newRecord.id,
            narration: `Offline wallet recharge — ${wallet.name}`,
            sourceModule: SOURCE_MODULES.WALLET,
        })

        return {
            success: true,
            message: `${formatRupeeAmount(amount)} added to ${wallet.name}'s wallet.`,
        }
    }

    const handleOpenWallet = (payload) => runLive(() => openWalletApi(payload), 'Wallet opened.')
    const handleSpend = (payload) => runLive(() => spendWalletApi(payload), 'Wallet spend recorded.')
    const handleStatusChange = async (row, status) => {
        let reason = ''
        if (status !== 'Active') {
            reason = window.prompt(`Reason for ${status.toLowerCase()} ${row.walletId}?`) || ''
            if (!reason.trim()) return
        }
        const result = await runLive(
            () => setWalletStatusApi({ walletId: row.walletId, status, reason: reason.trim() }),
            status === 'Active' ? 'Wallet reactivated.' : `Wallet ${status.toLowerCase()}.`,
        )
        if (!result.success) setError(result.message)
    }

    const summary = liveData.summary
    const liveReady = live && Boolean(summary)
    const wallets = live ? liveData.wallets : userWallets
    const recharges = live ? liveData.recharges : rechargeRecords

    return (
        <section className='space-y-5'>
            <PageHeader
                title='Wallet management'
                description={live
                    ? 'Open school wallets, record cash, cheque or bank-transfer credits and canteen / store spends. Online gateway recharge is not connected.'
                    : 'Review browser-stored wallet balances and record independently received cash credits without implying a connected wallet or payment service.'}
                context={live ? 'Live wallet ledger · online gateway disconnected' : 'Local wallet workspace · external payments disconnected'}
                actions={(
                    <>
                        <select
                            aria-label='Wallet role filter'
                            value={roleFilter}
                            onChange={(event) => setRoleFilter(event.target.value)}
                            className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'
                        >
                            {WALLET_ROLE_FILTERS.map((role) => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                        {live ? (
                            <>
                                <button type='button' onClick={refresh} disabled={loading} className={secondaryButton}><RefreshCw size={16} /> Refresh</button>
                                <button type='button' onClick={() => setOpenModal(true)} disabled={busy} className={secondaryButton}><Plus size={16} /> Open wallet</button>
                                <button type='button' onClick={() => setSpendModal(true)} disabled={busy} className={secondaryButton}><Minus size={16} /> Record spend</button>
                            </>
                        ) : null}
                        <button
                            type='button'
                            onClick={() => setRechargeModal(true)}
                            disabled={busy}
                            className={primaryButton}
                        >
                            <Wallet size={16} />
                            Record wallet credit
                        </button>
                        <button
                            type='button'
                            disabled
                            title='Export requires the connected wallet reporting API.'
                            className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-4 text-sm font-semibold text-[var(--erp-muted)] opacity-60'
                        >
                            <Download size={16} />
                            Export unavailable
                        </button>
                    </>
                )}
            />
            {live ? (
                <IntegrationNotice state='connected' title='Live wallet ledger (PostgreSQL)' description='Wallet balances, recharges and spends are saved on the server with idempotent references, balanced ledger postings and audit events. UPI, card and net-banking recharge need a payment gateway and stay disabled.' />
            ) : (
                <IntegrationNotice state='demo' title='Browser-stored wallet register' description='Balances, credits and records remain in this browser. Production requires a wallet ledger, idempotent transactions, RBAC, immutable audit events and settlement reconciliation.' />
            )}
            {error ? (
                <div role='alert' className='flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
                    <span>{error}</span>
                    {live ? <button type='button' onClick={refresh} className='underline cursor-pointer'>Retry</button> : null}
                </div>
            ) : null}
            {notice ? (
                <div role='status' className='rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'>{notice}</div>
            ) : null}
            {summary?.ledgerDrift?.length ? (
                <div role='alert' className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800'>
                    Wallet balance does not match its recharge/spend history for: {summary.ledgerDrift.join(', ')}.
                </div>
            ) : null}
            {loading ? <p className='text-sm text-[#667085]'>Loading wallets from campus finance…</p> : null}

            <div className='flex gap-2 overflow-x-auto border-b border-[var(--erp-line)]' role='tablist' aria-label='Wallet management views'>
                {WALLET_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type='button'
                        role='tab'
                        aria-selected={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`min-h-11 whitespace-nowrap border-b-2 px-3 text-sm font-semibold ${
                            activeTab === tab.id
                                ? 'border-[var(--erp-indigo)] text-[var(--erp-indigo)]'
                                : 'border-transparent text-[var(--erp-slate)]'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'wallet-overview' && (live
                ? (liveReady ? (
                    <WalletOverviewTab
                        cards={buildLiveOverviewCards(summary)}
                        balanceByRole={summary.balanceByRole}
                        spendCategories={summary.spendCategories}
                    />
                ) : null)
                : <WalletOverviewTab />)}
            {activeTab === 'user-wallets' && (live
                ? (liveReady ? <UserWalletsTab userWallets={wallets} initialRole={roleFilter} cards={buildLiveWalletCards(summary)} live busy={busy} onStatusChange={handleStatusChange} /> : null)
                : <UserWalletsTab userWallets={wallets} initialRole={roleFilter} />)}
            {activeTab === 'recharge-records' && (live
                ? (liveReady ? <RechargeRecordsTab rechargeRecords={recharges} initialRole={roleFilter} cards={buildLiveRechargeCards(summary)} live /> : null)
                : <RechargeRecordsTab rechargeRecords={rechargeRecords} initialRole={roleFilter} />)}
            {activeTab === 'spending-history' && (live
                ? (liveReady ? <SpendingHistoryTab spendingHistory={liveData.spends} initialRole={roleFilter} cards={buildLiveSpendCards(summary)} live /> : null)
                : <SpendingHistoryTab initialRole={roleFilter} />)}
            {activeTab === 'recharge-options' && (
                live ? <RechargeOptionsTab methods={liveData.rechargeMethods} live /> : <RechargeOptionsTab />
            )}

            <RechargeWalletModal
                isOpen={rechargeModal}
                onClose={() => setRechargeModal(false)}
                onOfflineRecharge={handleOfflineRecharge}
                live={live}
            />
            {live ? (
                <>
                    <OpenWalletModal isOpen={openModal} onClose={() => setOpenModal(false)} onSubmit={handleOpenWallet} />
                    <SpendWalletModal isOpen={spendModal} onClose={() => setSpendModal(false)} onSubmit={handleSpend} />
                </>
            ) : null}
        </section>
    )
}

export default WalletManagement
