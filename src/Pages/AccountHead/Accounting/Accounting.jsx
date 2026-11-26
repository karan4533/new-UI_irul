import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightLeft, BookOpen, Check, Download, FileText, Plus, RefreshCw, Upload } from 'lucide-react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ConfirmAction, IntegrationNotice, PageHeader } from '../../../Common/ui'
import { useFinance } from '../financeDomain/FinanceContext'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import AddOfflineEntryModal from './Components/AddOfflineEntryModal'
import AddAccountModal from './Components/AddAccountModal'
import BankBookTab, { buildBankBookSummary } from './Components/BankBookTab'
import BankReconciliationTab from './Components/BankReconciliationTab'
import {
    autoMatchReconciliation,
    buildBankReconciliationSummary,
    reconcileReconciliationEntry,
} from './Components/bankReconciliationState'
import CashBookTab, { buildCashBookSummary } from './Components/CashBookTab'
import ChartOfAccountsTab, { appendCoaAccount, buildCoaSummary } from './Components/ChartOfAccountsTab'
import DayBookTab, { appendDayBookEntry, buildDayBookSummary } from './Components/DayBookTab'
import FinancialStatementsTab from './Components/FinancialStatementsTab'
import GeneralLedgerTab, { buildGeneralLedgerSummary } from './Components/GeneralLedgerTab'
import JournalVouchersTab from './Components/JournalVouchersTab'
import NewJournalVoucherModal from './Components/NewJournalVoucherModal'
import OnlineBookTab, { buildOnlineBookSummary } from './Components/OnlineBookTab'
import { appendJournalVoucher, buildJournalVoucherSummary, postJournalVouchers } from './Components/journalVoucherState'
import {
    ACCOUNTING_SECTIONS,
    ACCOUNTING_YEARS,
    BANK_BOOK_OPENING_BALANCE,
    BANK_BOOK_REGISTER,
    BANK_RECONCILIATION_REGISTER,
    CASH_BOOK_OPENING_BALANCE,
    CASH_BOOK_REGISTER,
    COA_ACCOUNTS,
    DAY_BOOK_OPENING_BALANCE,
    DAY_BOOK_REGISTER,
    DEFAULT_ACCOUNTING_SECTION,
    GENERAL_LEDGER_REGISTER,
    JOURNAL_VOUCHERS_REGISTER,
    ONLINE_BOOK_REGISTER,
    parseRupeeAmount,
} from './accountingData'
import {
    createJournalVoucherApi,
    getFinancialStatementsApi,
    listBankReconciliationApi,
    listChartOfAccountsApi,
    listJournalVouchersApi,
    postJournalVoucherApi,
    reconcileBankEntryApi,
    upsertAccountApi,
} from '../../../services/api/accountingApiService.js'

const SECTION_SUBTITLES = {
    'day-book': 'Maintain the chronological record of offline and manual transactions.',
    'online-book': 'Review digital transactions already available in this workspace.',
    'general-ledger': 'Inspect the master ledger of posted accounting entries.',
    'cash-book': 'Review transactions that affect cash in hand.',
    'bank-book': 'Review transactions recorded against school bank accounts.',
    'chart-of-accounts': 'Maintain the accounting heads used throughout the ERP.',
    'journal-vouchers': 'Prepare and post balanced manual accounting adjustments.',
    'bank-reconciliation': 'Compare statement entries with ERP records before confirming a match.',
    'financial-statements': 'Generate an on-screen preview from the current finance registers.',
}

const LIVE_SECTION_SUBTITLES = {
    ...SECTION_SUBTITLES,
    'day-book': 'Chronological day-book entries from the campus finance API.',
    'online-book': 'Digital / gateway transactions from the campus finance API.',
    'general-ledger': 'Posted general-ledger lines from the campus finance API.',
    'cash-book': 'Cash-in-hand movements from the campus finance API.',
    'bank-book': 'Bank-account movements from the campus finance API.',
    'financial-statements': 'On-screen preview built from live finance registers.',
}

const primaryButton = 'inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButton = 'inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-indigo)] bg-white px-4 text-sm font-semibold text-[var(--erp-indigo)] disabled:cursor-not-allowed disabled:border-[var(--erp-line-strong)] disabled:text-[var(--erp-muted)] disabled:opacity-60'
const unavailableButton = 'inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-4 text-sm font-semibold text-[var(--erp-muted)] opacity-60'

const LIVE_ACCOUNTING = isLiveApiEnabled()
const seedRows = (rows) => (LIVE_ACCOUNTING ? [] : rows)
const openingBalance = (value) => (LIVE_ACCOUNTING ? 0 : value)

const Accounting = () => {
    const { section } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const finance = useFinance()
    const accountingBase = location.pathname.includes('/admin/expenses/accounting')
        ? '/admin/expenses/accounting'
        : location.pathname.includes('/super-admin/')
            ? '/super-admin/expenses/accounting'
            : '/account-head/accounting'
    const live = LIVE_ACCOUNTING
    // Live mode: every register comes from the server — demo registers are never shown.
    const [academicYear, setAcademicYear] = useState(ACCOUNTING_YEARS[0])
    const [addAccountModal, setAddAccountModal] = useState(false)
    const [newVoucherModal, setNewVoucherModal] = useState(false)
    const [addOfflineModal, setAddOfflineModal] = useState(false)
    const [postConfirmationOpen, setPostConfirmationOpen] = useState(false)
    const [dayBookEntries, setDayBookEntries] = useState(seedRows(DAY_BOOK_REGISTER))
    const [onlineBookEntries] = useState(seedRows(ONLINE_BOOK_REGISTER))
    const [selectedOnlineTransaction, setSelectedOnlineTransaction] = useState(null)
    const [generalLedgerEntries] = useState(seedRows(GENERAL_LEDGER_REGISTER))
    const [cashBookEntries] = useState(seedRows(CASH_BOOK_REGISTER))
    const [bankBookEntries] = useState(seedRows(BANK_BOOK_REGISTER))
    const [coaAccounts, setCoaAccounts] = useState(seedRows(COA_ACCOUNTS))
    const [journalVouchers, setJournalVouchers] = useState(seedRows(JOURNAL_VOUCHERS_REGISTER))
    const [selectedVoucherId, setSelectedVoucherId] = useState(null)
    const [reconciliationEntries, setReconciliationEntries] = useState(seedRows(BANK_RECONCILIATION_REGISTER))
    const [liveStatements, setLiveStatements] = useState(null)
    const [loading, setLoading] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [selectedReconciliationId, setSelectedReconciliationId] = useState(null)
    const [reconciliationDrawerOpen, setReconciliationDrawerOpen] = useState(false)
    const [selectedSuggestionId, setSelectedSuggestionId] = useState(null)
    const [financialStatementType, setFinancialStatementType] = useState('trial-balance')
    const [fsFilters, setFsFilters] = useState({
        financialYear: ACCOUNTING_YEARS[0],
        dateFrom: '2026-04-01',
        dateTo: live ? new Date().toISOString().slice(0, 10) : '2026-06-26',
        department: 'All Departments',
        campus: 'All Campuses',
    })
    const [appliedFsFilters, setAppliedFsFilters] = useState(fsFilters)
    const [fsLastGeneratedAt, setFsLastGeneratedAt] = useState(live ? '' : '26 Jun 2026, 4:30 PM')
    const ledgerRegisterRef = useRef(null)

    const activeSection = useMemo(
        () => ACCOUNTING_SECTIONS.find((item) => item.id === section)?.id ?? null,
        [section],
    )
    const activeLabel = ACCOUNTING_SECTIONS.find((item) => item.id === activeSection)?.label ?? 'Accounting'
    const selectedVoucher = journalVouchers.find((row) => row.id === selectedVoucherId) || null

    const loadRegisters = useCallback(async () => {
        if (!live) return
        setLoading(true)
        setError('')
        const [coaRes, jvRes, reconRes] = await Promise.all([
            listChartOfAccountsApi(),
            listJournalVouchersApi(),
            listBankReconciliationApi(),
        ])
        const failed = [coaRes, jvRes, reconRes].find((res) => !res.success)
        if (failed) {
            setError(failed.error || 'Could not load accounting registers.')
        } else {
            setCoaAccounts(coaRes.data.accounts)
            setJournalVouchers(jvRes.data.vouchers)
            setReconciliationEntries(reconRes.data.items)
        }
        setLoading(false)
    }, [live])

    const loadStatements = useCallback(async (filters) => {
        if (!live) return
        setBusy(true)
        setError('')
        const res = await getFinancialStatementsApi({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, department: filters.department })
        if (!res.success) {
            setError(res.error || 'Could not generate financial statements.')
        } else {
            setLiveStatements(res.data)
            setFsLastGeneratedAt(new Date().toLocaleString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
            }))
        }
        setBusy(false)
    }, [live])

    useEffect(() => {
        loadRegisters()
    }, [loadRegisters])

    useEffect(() => {
        if (live && activeSection === 'financial-statements' && !liveStatements) {
            loadStatements(appliedFsFilters)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [live, activeSection])

    // Run a mutating action, then refresh registers and the shared finance snapshot so the debounced state PUT never writes stale data.
    const runAction = async (action, successMessage) => {
        setBusy(true)
        setError('')
        setNotice('')
        const res = await action()
        if (!res.success) {
            setError(res.error || 'Action failed.')
            setBusy(false)
            return res
        }
        setNotice(res.data?.skipped ? 'Already recorded — no duplicate created.' : successMessage)
        await loadRegisters()
        if (typeof finance.rehydrateFromApi === 'function') await finance.rehydrateFromApi()
        setLiveStatements(null)
        setBusy(false)
        return res
    }

    const mergedDayBook = useMemo(() => [...finance.dayBookEntries, ...dayBookEntries], [finance.dayBookEntries, dayBookEntries])
    const mergedOnlineBook = useMemo(() => [...finance.onlineBookEntries, ...onlineBookEntries], [finance.onlineBookEntries, onlineBookEntries])
    const mergedGeneralLedger = useMemo(() => [...finance.glEntries, ...generalLedgerEntries], [finance.glEntries, generalLedgerEntries])
    const mergedCashBook = useMemo(() => [...finance.cashBookEntries, ...cashBookEntries], [finance.cashBookEntries, cashBookEntries])
    const mergedBankBook = useMemo(() => [...finance.bankBookEntries, ...bankBookEntries], [finance.bankBookEntries, bankBookEntries])

    const dayBookSummary = useMemo(() => buildDayBookSummary(mergedDayBook, openingBalance(DAY_BOOK_OPENING_BALANCE)), [mergedDayBook])
    const onlineBookSummary = useMemo(() => buildOnlineBookSummary(mergedOnlineBook), [mergedOnlineBook])
    const generalLedgerSummary = useMemo(() => buildGeneralLedgerSummary(mergedGeneralLedger), [mergedGeneralLedger])
    const cashBookSummary = useMemo(() => buildCashBookSummary(mergedCashBook, openingBalance(CASH_BOOK_OPENING_BALANCE)), [mergedCashBook])
    const bankBookSummary = useMemo(() => buildBankBookSummary(mergedBankBook, openingBalance(BANK_BOOK_OPENING_BALANCE)), [mergedBankBook])
    const coaSummary = useMemo(() => buildCoaSummary(coaAccounts), [coaAccounts])
    const journalVoucherSummary = useMemo(() => buildJournalVoucherSummary(journalVouchers), [journalVouchers])
    const bankReconciliationSummary = useMemo(() => buildBankReconciliationSummary(reconciliationEntries), [reconciliationEntries])

    const handleAddOfflineEntry = (entry) => {
        setDayBookEntries((previous) => appendDayBookEntry(previous, openingBalance(DAY_BOOK_OPENING_BALANCE), entry))
        finance.addManualEntry({
            date: entry.date,
            amount: entry.debit !== '—' ? entry.debit : entry.credit,
            paymentMode: entry.paymentMethod === 'Cash' ? 'CASH' : 'BANK_TRANSFER',
            narration: entry.description,
            category: entry.ledgerHead,
            entryType: entry.transactionType,
            status: 'DRAFT',
        })
    }

    const handleAddJournalVoucher = (voucher) => {
        if (live) {
            runAction(
                () => createJournalVoucherApi({
                    voucherNo: voucher.voucherNo,
                    dateIso: voucher.dateIso,
                    description: voucher.description,
                    debitAccount: voucher.debitAccount,
                    creditAccount: voucher.creditAccount,
                    amount: parseRupeeAmount(voucher.amount),
                    remarks: voucher.remarks,
                }),
                'Journal voucher saved as draft.',
            )
            setSelectedVoucherId(null)
            return
        }
        setJournalVouchers((previous) => appendJournalVoucher(previous, voucher))
        setSelectedVoucherId(null)
    }

    const handleAddAccount = (account) => {
        if (live) {
            runAction(
                () => upsertAccountApi({
                    accountCode: account.accountCode,
                    accountName: account.accountName,
                    accountType: account.accountType,
                    parentAccount: account.parentAccount,
                    status: account.status,
                    openingBalance: parseRupeeAmount(account.balance),
                }),
                'Account saved.',
            )
            return
        }
        setCoaAccounts((previous) => appendCoaAccount(previous, account))
    }

    const handlePostVoucher = () => {
        if (!selectedVoucherId) return
        if (live) {
            const voucherId = selectedVoucherId
            setPostConfirmationOpen(false)
            runAction(() => postJournalVoucherApi(voucherId), 'Journal voucher posted to the ledger.')
            setSelectedVoucherId(null)
            return
        }
        setJournalVouchers((previous) => postJournalVouchers(previous, selectedVoucherId))
        setSelectedVoucherId(null)
        setPostConfirmationOpen(false)
    }

    const reviewReconciliation = (id) => {
        const entry = reconciliationEntries.find((row) => row.id === id)
        setSelectedReconciliationId(id)
        setSelectedSuggestionId(entry?.detail?.suggestions?.[0]?.id ?? null)
        setReconciliationDrawerOpen(true)
    }

    const reconcileEntry = (entryId, suggestionId, evidence) => {
        if (live) {
            setReconciliationDrawerOpen(false)
            setSelectedReconciliationId(null)
            runAction(
                () => reconcileBankEntryApi({ entryId, ...evidence }),
                'Bank statement evidence recorded.',
            )
            return
        }
        setReconciliationEntries((previous) => reconcileReconciliationEntry(previous, entryId, suggestionId))
        setReconciliationDrawerOpen(false)
        setSelectedReconciliationId(null)
        setSelectedSuggestionId(null)
    }

    const generatePreview = () => {
        setAppliedFsFilters({ ...fsFilters })
        if (live) {
            loadStatements(fsFilters)
            return
        }
        setFsLastGeneratedAt(new Date().toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
        }))
    }

    const exportUnavailable = (
        <button type='button' disabled title='Export requires the connected finance reporting API.' className={unavailableButton}>
            <Download aria-hidden='true' size={16} /> Export unavailable
        </button>
    )

    const renderActions = () => {
        if (activeSection === 'day-book') return (
            <>
                <button type='button' onClick={() => setAddOfflineModal(true)} className={primaryButton}><Plus aria-hidden='true' size={16} /> Add offline entry</button>
                {exportUnavailable}
            </>
        )
        if (activeSection === 'online-book') return (
            <>
                <button type='button' disabled title='No payment gateway or banking API is connected.' className={unavailableButton}><RefreshCw aria-hidden='true' size={16} /> Sync unavailable</button>
                {exportUnavailable}
            </>
        )
        if (activeSection === 'general-ledger') return (
            <>
                <button type='button' onClick={() => ledgerRegisterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={primaryButton}><BookOpen aria-hidden='true' size={16} /> View ledger</button>
                {exportUnavailable}
            </>
        )
        if (activeSection === 'bank-book') return (
            <>
                <button type='button' onClick={() => navigate(`${accountingBase}/bank-reconciliation`)} className={primaryButton}><ArrowRightLeft aria-hidden='true' size={16} /> Reconcile</button>
                {exportUnavailable}
            </>
        )
        if (activeSection === 'chart-of-accounts') return (
            <>
                <button type='button' onClick={() => setAddAccountModal(true)} className={primaryButton}><Plus aria-hidden='true' size={16} /> Add account</button>
                <button type='button' disabled title='Import requires the connected accounting API and a validated file contract.' className={unavailableButton}><Upload aria-hidden='true' size={16} /> Import unavailable</button>
                {exportUnavailable}
            </>
        )
        if (activeSection === 'journal-vouchers') return (
            <>
                <button type='button' onClick={() => setNewVoucherModal(true)} className={primaryButton}><Plus aria-hidden='true' size={16} /> New journal voucher</button>
                <button type='button' onClick={() => setPostConfirmationOpen(true)} disabled={!selectedVoucher || selectedVoucher.status === 'Posted'} className={secondaryButton}><Check aria-hidden='true' size={16} /> Post selected voucher</button>
                {exportUnavailable}
            </>
        )
        if (activeSection === 'bank-reconciliation') return (
            <>
                <button type='button' disabled title='Statement import requires a connected bank feed or approved file parser.' className={unavailableButton}><Upload aria-hidden='true' size={16} /> Import unavailable</button>
                {live ? (
                    <button type='button' onClick={loadRegisters} disabled={loading} className={secondaryButton}><RefreshCw aria-hidden='true' size={16} /> Refresh</button>
                ) : (
                    <button type='button' onClick={() => setReconciliationEntries((previous) => autoMatchReconciliation(previous))} className={secondaryButton}><RefreshCw aria-hidden='true' size={16} /> Run local match rules</button>
                )}
                {exportUnavailable}
            </>
        )
        if (activeSection === 'financial-statements') return (
            <>
                <button type='button' onClick={generatePreview} className={primaryButton}><FileText aria-hidden='true' size={16} /> Generate preview</button>
                {exportUnavailable}
            </>
        )
        return exportUnavailable
    }

    if (!activeSection) return <Navigate to={`${accountingBase}/${DEFAULT_ACCOUNTING_SECTION}`} replace />

    return (
        <section className='space-y-5'>
            <PageHeader
                title={activeLabel}
                description={(live ? LIVE_SECTION_SUBTITLES : SECTION_SUBTITLES)[activeSection]}
                context={live
                    ? `Academic year ${academicYear} · live finance API`
                    : `Academic year ${academicYear} · browser-stored workspace`}
                actions={renderActions()}
            />

            <div className='flex justify-end'>
                <label className='grid gap-1 text-xs font-semibold text-[var(--erp-slate)]'>Academic year
                    <select value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm font-medium text-[var(--erp-ink)]'>
                        {ACCOUNTING_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                </label>
            </div>

            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live accounting ledger (PostgreSQL)'
                    description='Chart of accounts, journal vouchers, bank reconciliation evidence and financial statements are saved on the server with audit events. Bank statement import and report export are not connected yet.'
                />
            ) : (
                <IntegrationNotice
                    state='demo'
                    title='Browser-stored accounting workspace'
                    description='Entries, posting decisions and reconciliation changes remain in this browser. No banking, accounting, reporting or document-storage API is connected.'
                />
            )}
            {error ? (
                <div role='alert' className='flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
                    <span>{error}</span>
                    {live ? <button type='button' onClick={loadRegisters} className='underline cursor-pointer'>Retry</button> : null}
                </div>
            ) : null}
            {notice ? (
                <div role='status' className='rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'>{notice}</div>
            ) : null}
            {loading || busy ? <p className='text-sm text-[#667085]'>{busy ? 'Saving to the campus ledger…' : 'Loading accounting registers from campus finance…'}</p> : null}

            {activeSection === 'day-book' && <DayBookTab entries={mergedDayBook} summary={dayBookSummary} onEditNarration={finance.editNarration} />}
            {activeSection === 'online-book' && <OnlineBookTab entries={mergedOnlineBook} summary={onlineBookSummary} selectedTransaction={selectedOnlineTransaction} onSelectTransaction={setSelectedOnlineTransaction} onCloseDetails={() => setSelectedOnlineTransaction(null)} />}
            {activeSection === 'general-ledger' && <GeneralLedgerTab entries={mergedGeneralLedger} summary={generalLedgerSummary} registerRef={ledgerRegisterRef} />}
            {activeSection === 'cash-book' && <CashBookTab entries={mergedCashBook} summary={cashBookSummary} />}
            {activeSection === 'bank-book' && <BankBookTab entries={mergedBankBook} summary={bankBookSummary} />}
            {activeSection === 'chart-of-accounts' && <ChartOfAccountsTab accounts={coaAccounts} summary={coaSummary} live={live} />}
            {activeSection === 'journal-vouchers' && <JournalVouchersTab vouchers={journalVouchers} summary={journalVoucherSummary} selectedId={selectedVoucherId} onSelect={setSelectedVoucherId} />}
            {activeSection === 'bank-reconciliation' && (
                <BankReconciliationTab
                    entries={reconciliationEntries}
                    summary={bankReconciliationSummary}
                    selectedId={selectedReconciliationId}
                    onReview={reviewReconciliation}
                    drawerOpen={reconciliationDrawerOpen}
                    onCloseDrawer={() => setReconciliationDrawerOpen(false)}
                    onReconcile={reconcileEntry}
                    selectedSuggestionId={selectedSuggestionId}
                    onSelectSuggestion={setSelectedSuggestionId}
                    live={live}
                    busy={busy}
                />
            )}
            {activeSection === 'financial-statements' && <FinancialStatementsTab statementType={financialStatementType} onStatementTypeChange={setFinancialStatementType} filters={fsFilters} onFilterChange={(key, value) => setFsFilters((previous) => ({ ...previous, [key]: value }))} appliedFilters={appliedFsFilters} lastGeneratedAt={fsLastGeneratedAt} isGenerating={live && busy && !liveStatements} liveStatements={liveStatements} liveMode={live} />}

            <ConfirmAction
                open={postConfirmationOpen}
                onClose={() => setPostConfirmationOpen(false)}
                onConfirm={handlePostVoucher}
                title={`Post ${selectedVoucher?.id || 'selected voucher'}?`}
                description={live
                    ? 'Posting writes balanced debit and credit lines to the campus general ledger with an audit event. A posted voucher cannot be edited.'
                    : 'Posting changes this browser-stored voucher from draft to posted. Production posting must also enforce a locked accounting period, balanced lines, permissions and an immutable audit event.'}
                confirmLabel='Post voucher'
                confirmDisabled={!selectedVoucher || selectedVoucher.status === 'Posted'}
            />
            <AddAccountModal isOpen={addAccountModal} onClose={() => setAddAccountModal(false)} onSubmit={handleAddAccount} />
            <NewJournalVoucherModal isOpen={newVoucherModal} onClose={() => setNewVoucherModal(false)} onSubmit={handleAddJournalVoucher} />
            <AddOfflineEntryModal isOpen={addOfflineModal} onClose={() => setAddOfflineModal(false)} onSubmit={handleAddOfflineEntry} />
        </section>
    )
}

export default Accounting
