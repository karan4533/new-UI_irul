import React, { useState, useMemo, useEffect } from 'react'
import {
    CreditCard,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    ShieldCheck,
    Cpu,
    ArrowRightLeft,
    Clock,
    Plus,
    X,
    Filter,
    Download,
    Wifi,
    Building2,
    Check,
    Smartphone,
} from 'lucide-react'
import { toast } from 'react-toastify'
import {
    PageHeader,
    EnterpriseKpiCard,
    StatusBadge,
    DataTable,
    IntegrationNotice,
} from '../../../Common/ui'
import {
    getPosTerminals,
    addPosTerminal,
    updatePosTerminal,
    deletePosTerminal,
    getPosTransactions,
    reconcileTransaction,
    getPosSyncLogs,
    executePosSync,
    getPosSettings,
    updatePosSettings,
} from './posEdcData'

const TABS = [
    { id: 'transactions', label: 'Live Transactions & Inflows', icon: CreditCard },
    { id: 'reconciliation', label: 'Reconciliation & Matching', icon: ArrowRightLeft },
    { id: 'devices', label: 'Device Configuration', icon: Cpu },
    { id: 'logs', label: 'Sync Audit History', icon: Clock },
]

export default function PosEdcSyncWorkspace() {
    const [activeTab, setActiveTab] = useState('transactions')
    const [terminals, setTerminals] = useState(() => getPosTerminals())
    const [transactions, setTransactions] = useState(() => getPosTransactions())
    const [syncLogs, setSyncLogs] = useState(() => getPosSyncLogs())
    const [settings, setSettings] = useState(() => getPosSettings())
    const [isSyncing, setIsSyncing] = useState(false)

    // Filter states
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [reconFilter, setReconFilter] = useState('all')

    // Modals
    const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false)
    const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false)
    const [selectedTxnForRecon, setSelectedTxnForRecon] = useState(null)
    const [manualInvoiceId, setManualInvoiceId] = useState('')
    const [manualReconNotes, setManualReconNotes] = useState('')

    // Form state for new device
    const [newDevice, setNewDevice] = useState({
        terminalId: '',
        name: '',
        provider: 'Paytm Payments Bank / EDC',
        model: 'Paytm Android Smart POS (T500)',
        merchantId: 'MID_QM_CAMPUS_01',
        counterLocation: 'Main Fee Counter',
        assignedOperator: 'Duty Cashier',
        serialNumber: '',
        connectionType: '4G SIM + Wi-Fi',
    })

    const refreshData = () => {
        setTerminals(getPosTerminals())
        setTransactions(getPosTransactions())
        setSyncLogs(getPosSyncLogs())
        setSettings(getPosSettings())
    }

    // Auto-sync timer simulation based on settings interval
    useEffect(() => {
        if (!settings.autoSyncEnabled) return

        let intervalMs = 15 * 60 * 1000
        if (settings.syncInterval === '15m') intervalMs = 15 * 60 * 1000
        else if (settings.syncInterval === '30m') intervalMs = 30 * 60 * 1000
        else if (settings.syncInterval === '1h') intervalMs = 60 * 60 * 1000
        else if (settings.syncInterval === 'daily') intervalMs = 24 * 60 * 60 * 1000

        // In demo UI, interval is active in background
        const timer = setInterval(() => {
            const res = executePosSync(null, `Auto-Scheduler (${settings.syncInterval} Interval)`)
            refreshData()
            toast.info(`Auto-synced POS terminal batch: ${res.syncedCount} records polled.`)
        }, intervalMs)

        return () => clearInterval(timer)
    }, [settings.autoSyncEnabled, settings.syncInterval])

    const handleManualSync = () => {
        setIsSyncing(true)
        setTimeout(() => {
            try {
                const res = executePosSync(null, 'Manual Trigger (Account Head)')
                refreshData()
                setIsSyncing(false)
                toast.info(
                    `Demo POS sync only (not live gateway). ${res.syncedCount} local records refreshed from ${terminals.filter((t) => t.status === 'Active').length} demo terminals.`,
                )
            } catch {
                setIsSyncing(false)
                toast.error('Demo POS sync failed in this browser. No live gateway was contacted.')
            }
        }, 900)
    }

    const handleAddDeviceSubmit = (e) => {
        e.preventDefault()
        if (!newDevice.terminalId || !newDevice.name) {
            toast.error('Terminal ID and Device Name are required.')
            return
        }
        addPosTerminal(newDevice)
        refreshData()
        setIsAddDeviceOpen(false)
        setNewDevice({
            terminalId: '',
            name: '',
            provider: 'Paytm Payments Bank / EDC',
            model: 'Paytm Android Smart POS (T500)',
            merchantId: 'MID_QM_CAMPUS_01',
            counterLocation: 'Main Fee Counter',
            assignedOperator: 'Duty Cashier',
            serialNumber: '',
            connectionType: '4G SIM + Wi-Fi',
        })
        toast.success('Payment machine registered successfully and linked to gateway.')
    }

    const handleToggleDeviceStatus = (terminal) => {
        const nextStatus = terminal.status === 'Active' ? 'Inactive' : 'Active'
        updatePosTerminal(terminal.id, { status: nextStatus })
        refreshData()
        toast.info(`Terminal ${terminal.terminalId} is now ${nextStatus}.`)
    }

    const handleTestConnectivity = (terminal) => {
        toast.info(`Testing handshake with ${terminal.name}...`)
        setTimeout(() => {
            toast.success(`Handshake SUCCESS! Terminal ${terminal.terminalId} is online (Ping: 42ms).`)
        }, 600)
    }

    const handleOpenReconcileModal = (txn) => {
        setSelectedTxnForRecon(txn)
        setManualInvoiceId(txn.feeInvoiceId || `INV-2025-FEES-${Math.floor(1000 + Math.random() * 9000)}`)
        setManualReconNotes(txn.notes || '')
        setIsReconcileModalOpen(true)
    }

    const handleSaveReconciliation = (e) => {
        e.preventDefault()
        if (!selectedTxnForRecon) return
        reconcileTransaction(selectedTxnForRecon.id, manualInvoiceId.trim(), manualReconNotes.trim())
        refreshData()
        setIsReconcileModalOpen(false)
        setSelectedTxnForRecon(null)
        toast.success(`Transaction ${selectedTxnForRecon.transactionRef} successfully matched with ${manualInvoiceId.trim()}.`)
    }

    // KPI Aggregates
    const stats = useMemo(() => {
        const total = transactions.length
        const totalAmount = transactions
            .filter((t) => t.status === 'SUCCESS')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0)
        const matchedCount = transactions.filter((t) => t.reconciliationStatus === 'Matched').length
        const rate = total > 0 ? Math.round((matchedCount / total) * 100) : 100
        const discrepancies = transactions.filter(
            (t) => t.reconciliationStatus === 'Discrepancy' || t.reconciliationStatus === 'Unlinked POS Transaction' || t.reconciliationStatus === 'Duplicate Transaction'
        ).length
        return { total, totalAmount, rate, discrepancies }
    }, [transactions])

    // Filtered transactions
    const filteredTransactions = useMemo(() => {
        return transactions.filter((t) => {
            const q = searchQuery.toLowerCase()
            const matchesQuery =
                !q ||
                t.transactionRef.toLowerCase().includes(q) ||
                (t.studentName || '').toLowerCase().includes(q) ||
                (t.terminalId || '').toLowerCase().includes(q) ||
                (t.paymentMethod || '').toLowerCase().includes(q)
            const matchesStatus = statusFilter === 'all' || t.status === statusFilter
            const matchesRecon = reconFilter === 'all' || t.reconciliationStatus === reconFilter
            return matchesQuery && matchesStatus && matchesRecon
        })
    }, [transactions, searchQuery, statusFilter, reconFilter])

    // Status styling helpers
    const getReconBadge = (reconStatus) => {
        switch (reconStatus) {
            case 'Matched':
                return <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200'><CheckCircle2 size={12} /> Matched</span>
            case 'Discrepancy':
                return <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200'><AlertTriangle size={12} /> Discrepancy</span>
            case 'Unlinked POS Transaction':
                return <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200'><ArrowRightLeft size={12} /> Unlinked Fee</span>
            case 'Duplicate Transaction':
                return <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200'><AlertTriangle size={12} /> Duplicate Swipe</span>
            case 'Failed Transaction':
                return <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200'><X size={12} /> Failed Swipe</span>
            default:
                return <StatusBadge status={reconStatus || 'Pending'} />
        }
    }

    return (
        <section className='space-y-6 pb-8'>
            <IntegrationNotice
                state='mock'
                title='POS / EDC — MOCK / gateway BLOCKED'
                description='No live POS/EDC gateway is configured (finance gateway may return NOT_CONFIGURED). Device lists, sync, and reconciliation below are browser demonstration only — never treat toast success as a bank capture.'
            />
            <PageHeader
                title='POS / EDC Machine Transaction Synchronization'
                description='Manage campus payment machines, synchronize live swipe batches from Paytm and PineLabs EDC devices, reconcile collections against student fee ledgers, and track automated sync audits.'
                context='Central Finance & Accounts Gateway · Academic Year 2025–26'
                actions={(
                    <div className='flex flex-wrap items-center gap-2.5'>
                        <button
                            type='button'
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            className='inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-60 cursor-pointer'
                        >
                            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                            {isSyncing ? 'Syncing POS Devices…' : 'Sync Now with POS Devices'}
                        </button>
                        <button
                            type='button'
                            onClick={() => setIsAddDeviceOpen(true)}
                            className='inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer'
                        >
                            <Plus size={14} className='text-blue-600' /> Register POS Device
                        </button>
                    </div>
                )}
            />

            {/* 4 Soft KPI Metric Cards */}
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
                <EnterpriseKpiCard
                    title='Total POS Transactions'
                    value={stats.total}
                    change={`${terminals.filter(t => t.status === 'Active').length} Active Terminals`}
                    isPositive={true}
                    context='Paytm & PineLabs EDC batches'
                />
                <EnterpriseKpiCard
                    title='Total Inflow Settled'
                    value={`₹${stats.totalAmount.toLocaleString('en-IN')}`}
                    change='+14.2% today'
                    isPositive={true}
                    context='Card, UPI & Dynamic QR Collections'
                />
                <EnterpriseKpiCard
                    title='Reconciliation Match Rate'
                    value={`${stats.rate}%`}
                    change='Auto-Matched'
                    isPositive={stats.rate >= 85}
                    context='Matched with student fee vouchers'
                />
                <EnterpriseKpiCard
                    title='Attention / Mismatches'
                    value={stats.discrepancies}
                    change={stats.discrepancies === 0 ? 'Zero Variance' : 'Action Required'}
                    isPositive={stats.discrepancies === 0}
                    context='Unlinked invoices or amount variance'
                />
            </div>

            {/* Tabs Navigation */}
            <div className='flex gap-2 overflow-x-auto border-b border-slate-200'>
                {TABS.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            type='button'
                            role='tab'
                            aria-selected={isActive}
                            onClick={() => setActiveTab(tab.id)}
                            className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold transition cursor-pointer ${
                                isActive
                                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                            }`}
                        >
                            <Icon size={15} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* TAB 1: LIVE TRANSACTIONS */}
            {activeTab === 'transactions' && (
                <div className='space-y-4'>
                    {/* Filter & Auto-Sync Control Bar */}
                    <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4'>
                        <div className='flex flex-wrap items-center gap-3 flex-1'>
                            <div className='relative min-w-[240px] flex-1'>
                                <input
                                    type='text'
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder='Search RRN, Student, Terminal ID, Card...'
                                    className='w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs focus:bg-white focus:outline-blue-500'
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className='rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700'
                            >
                                <option value='all'>All Gateway Statuses</option>
                                <option value='SUCCESS'>SUCCESS</option>
                                <option value='PENDING'>PENDING</option>
                                <option value='FAILED'>FAILED</option>
                            </select>
                            <select
                                value={reconFilter}
                                onChange={(e) => setReconFilter(e.target.value)}
                                className='rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700'
                            >
                                <option value='all'>All Reconciliation States</option>
                                <option value='Matched'>Matched</option>
                                <option value='Unlinked POS Transaction'>Unlinked POS</option>
                                <option value='Discrepancy'>Discrepancy</option>
                                <option value='Duplicate Transaction'>Duplicate Swipe</option>
                            </select>
                        </div>

                        {/* Automated Interval Selector */}
                        <div className='flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4'>
                            <span className='text-xs font-medium text-slate-500 whitespace-nowrap'>Auto-Sync Interval:</span>
                            <select
                                value={settings.syncInterval}
                                onChange={(e) => {
                                    const next = updatePosSettings({ syncInterval: e.target.value })
                                    setSettings(next)
                                    toast.success(`Automated POS sync interval set to ${e.target.value}.`)
                                }}
                                className='rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700'
                            >
                                <option value='15m'>Every 15 Minutes</option>
                                <option value='30m'>Every 30 Minutes</option>
                                <option value='1h'>Hourly Batch</option>
                                <option value='daily'>Daily Midnight</option>
                            </select>
                        </div>
                    </div>

                    {/* Transactions DataTable */}
                    <div className='rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden'>
                        <div className='p-4 border-b border-slate-100 flex items-center justify-between'>
                            <div>
                                <h3 className='text-sm font-bold text-slate-900'>POS Terminal Swipes & Settlement Feed</h3>
                                <p className='text-xs text-slate-500'>Showing {filteredTransactions.length} of {transactions.length} total records from connected EDC machines.</p>
                            </div>
                        </div>

                        <div className='overflow-x-auto'>
                            <table className='w-full text-xs text-left'>
                                <thead className='bg-slate-50 text-slate-600 font-semibold border-b border-slate-200'>
                                    <tr>
                                        <th className='px-4 py-3'>Timestamp / RRN</th>
                                        <th className='px-4 py-3'>Terminal / Location</th>
                                        <th className='px-4 py-3'>Student / Payer</th>
                                        <th className='px-4 py-3'>Amount (₹)</th>
                                        <th className='px-4 py-3'>Payment Mode</th>
                                        <th className='px-4 py-3'>Gateway Status</th>
                                        <th className='px-4 py-3'>ERP Reconciliation</th>
                                        <th className='px-4 py-3 text-right'>Action</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-slate-100'>
                                    {filteredTransactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className='py-8 text-center text-slate-400'>
                                                No transactions found matching the selected filter criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTransactions.map((row) => (
                                            <tr key={row.id} className='hover:bg-slate-50/80 transition-colors'>
                                                <td className='px-4 py-3'>
                                                    <span className='font-mono font-bold text-slate-900'>{row.transactionRef}</span>
                                                    <span className='block text-[11px] text-slate-400'>{new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(row.timestamp).toLocaleDateString()}</span>
                                                </td>
                                                <td className='px-4 py-3'>
                                                    <span className='font-semibold text-slate-800'>{row.terminalId}</span>
                                                    <span className='block text-[11px] text-slate-500'>Counter Desk</span>
                                                </td>
                                                <td className='px-4 py-3'>
                                                    <span className='font-semibold text-slate-900'>{row.studentName || 'Counter Walk-in'}</span>
                                                    <span className='block text-[11px] text-blue-600'>{row.feeInvoiceId || 'Pending Voucher Link'}</span>
                                                </td>
                                                <td className='px-4 py-3 font-bold text-slate-900'>
                                                    ₹{Number(row.amount).toLocaleString('en-IN')}
                                                </td>
                                                <td className='px-4 py-3'>
                                                    <span className='text-slate-700'>{row.paymentMethod}</span>
                                                    <span className='block text-[11px] text-slate-400 font-mono'>{row.paymentMode}</span>
                                                </td>
                                                <td className='px-4 py-3'>
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${row.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className='px-4 py-3'>
                                                    {getReconBadge(row.reconciliationStatus)}
                                                </td>
                                                <td className='px-4 py-3 text-right'>
                                                    {row.reconciliationStatus !== 'Matched' ? (
                                                        <button
                                                            type='button'
                                                            onClick={() => handleOpenReconcileModal(row)}
                                                            className='px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 transition cursor-pointer'
                                                        >
                                                            Reconcile
                                                        </button>
                                                    ) : (
                                                        <span className='text-emerald-600 font-semibold text-[11px] flex items-center justify-end gap-1'>
                                                            <Check size={13} /> Verified
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: RECONCILIATION & MATCHING */}
            {activeTab === 'reconciliation' && (
                <div className='space-y-4'>
                    <div className='rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 space-y-2'>
                        <div className='flex items-center gap-2'>
                            <ShieldCheck className='text-blue-600' size={18} />
                            <h3 className='text-sm font-bold text-blue-900'>Automated Two-Way Settlement Reconciliation</h3>
                        </div>
                        <p className='text-xs text-blue-800 leading-relaxed'>
                            This engine validates incoming POS credit charges against active student fee demand bills. Matches with exact amount and bank reference are marked <strong>Matched</strong> automatically. Unlinked counter swipes and fee variances require Account Head review.
                        </p>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        <div className='p-4 rounded-xl border border-emerald-200 bg-white shadow-2xs space-y-1'>
                            <span className='text-xs font-semibold text-slate-500'>Matched & Cleared</span>
                            <div className='text-xl font-bold text-emerald-700'>
                                {transactions.filter(t => t.reconciliationStatus === 'Matched').length} Records
                            </div>
                            <span className='text-[11px] text-slate-400'>100% receipt and bank ledger agreement</span>
                        </div>
                        <div className='p-4 rounded-xl border border-amber-200 bg-white shadow-2xs space-y-1'>
                            <span className='text-xs font-semibold text-slate-500'>Unlinked Swipes</span>
                            <div className='text-xl font-bold text-amber-700'>
                                {transactions.filter(t => t.reconciliationStatus === 'Unlinked POS Transaction').length} Records
                            </div>
                            <span className='text-[11px] text-slate-400'>Swiped on POS; awaiting invoice link</span>
                        </div>
                        <div className='p-4 rounded-xl border border-rose-200 bg-white shadow-2xs space-y-1'>
                            <span className='text-xs font-semibold text-slate-500'>Variances & Duplicates</span>
                            <div className='text-xl font-bold text-rose-700'>
                                {transactions.filter(t => t.reconciliationStatus === 'Discrepancy' || t.reconciliationStatus === 'Duplicate Transaction').length} Records
                            </div>
                            <span className='text-[11px] text-slate-400'>Amount drift or rapid duplicate swipes</span>
                        </div>
                    </div>

                    <div className='rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden'>
                        <div className='p-4 border-b border-slate-100 flex items-center justify-between'>
                            <h3 className='text-sm font-bold text-slate-900'>Exception & Unreconciled Items Register</h3>
                            <button
                                type='button'
                                onClick={() => {
                                    transactions
                                        .filter(t => t.reconciliationStatus === 'Unlinked POS Transaction')
                                        .forEach(t => reconcileTransaction(t.id, `INV-AUTO-${Math.floor(1000 + Math.random() * 9000)}`))
                                    refreshData()
                                    toast.success('Auto-reconciled all pending unlinked counter transactions!')
                                }}
                                className='px-3 py-1.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition cursor-pointer'
                            >
                                Auto-Reconcile All Unlinked
                            </button>
                        </div>

                        <div className='overflow-x-auto'>
                            <table className='w-full text-xs text-left'>
                                <thead className='bg-slate-50 text-slate-600 font-semibold border-b border-slate-200'>
                                    <tr>
                                        <th className='px-4 py-3'>Ref / Date</th>
                                        <th className='px-4 py-3'>Terminal</th>
                                        <th className='px-4 py-3'>Student / Account</th>
                                        <th className='px-4 py-3'>Amount</th>
                                        <th className='px-4 py-3'>Status Reason / Audit Note</th>
                                        <th className='px-4 py-3 text-right'>Action</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-slate-100'>
                                    {transactions.filter(t => t.reconciliationStatus !== 'Matched').map((row) => (
                                        <tr key={row.id} className='hover:bg-slate-50/80 transition-colors'>
                                            <td className='px-4 py-3 font-mono font-bold text-slate-900'>
                                                {row.transactionRef}
                                                <span className='block text-[11px] text-slate-400 font-normal'>{new Date(row.timestamp).toLocaleDateString()}</span>
                                            </td>
                                            <td className='px-4 py-3'>{row.terminalId}</td>
                                            <td className='px-4 py-3 font-semibold text-slate-800'>{row.studentName || 'Counter Walk-in'}</td>
                                            <td className='px-4 py-3 font-bold text-slate-900'>₹{Number(row.amount).toLocaleString('en-IN')}</td>
                                            <td className='px-4 py-3 text-slate-600 max-w-xs leading-snug'>
                                                <span className='font-semibold text-amber-800 block'>{row.reconciliationStatus}</span>
                                                {row.notes}
                                            </td>
                                            <td className='px-4 py-3 text-right'>
                                                <button
                                                    type='button'
                                                    onClick={() => handleOpenReconcileModal(row)}
                                                    className='px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition cursor-pointer'
                                                >
                                                    Resolve & Match
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: DEVICE CONFIGURATION */}
            {activeTab === 'devices' && (
                <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <h3 className='text-sm font-bold text-slate-900'>Registered Campus Payment Machines</h3>
                            <p className='text-xs text-slate-500'>Manage active EDC swipe machines, Paytm Soundbox devices, and merchant terminal IDs.</p>
                        </div>
                        <button
                            type='button'
                            onClick={() => setIsAddDeviceOpen(true)}
                            className='inline-flex items-center gap-1.5 rounded-xl bg-blue-600 text-white px-3.5 py-2 text-xs font-semibold hover:bg-blue-700 transition cursor-pointer shadow-sm'
                        >
                            <Plus size={14} /> Add New Payment Device
                        </button>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        {terminals.map((terminal) => (
                            <div key={terminal.id} className='rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4'>
                                <div className='flex items-start justify-between gap-3'>
                                    <div className='flex items-center gap-3'>
                                        <div className='p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100'>
                                            <Smartphone size={20} />
                                        </div>
                                        <div>
                                            <h4 className='text-sm font-bold text-slate-900'>{terminal.name}</h4>
                                            <span className='font-mono text-xs text-slate-500'>TID: {terminal.terminalId}</span>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${terminal.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                                        {terminal.status}
                                    </span>
                                </div>

                                <div className='grid grid-cols-2 gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100'>
                                    <div>
                                        <span className='text-slate-400 block text-[11px]'>Provider:</span>
                                        <span className='font-semibold text-slate-800'>{terminal.provider}</span>
                                    </div>
                                    <div>
                                        <span className='text-slate-400 block text-[11px]'>Hardware Model:</span>
                                        <span className='font-semibold text-slate-800'>{terminal.model}</span>
                                    </div>
                                    <div>
                                        <span className='text-slate-400 block text-[11px]'>Location:</span>
                                        <span className='font-semibold text-slate-800'>{terminal.counterLocation}</span>
                                    </div>
                                    <div>
                                        <span className='text-slate-400 block text-[11px]'>Assigned Cashier:</span>
                                        <span className='font-semibold text-slate-800'>{terminal.assignedOperator}</span>
                                    </div>
                                    <div>
                                        <span className='text-slate-400 block text-[11px]'>Connection:</span>
                                        <span className='font-semibold text-slate-800'>{terminal.connectionType}</span>
                                    </div>
                                    <div>
                                        <span className='text-slate-400 block text-[11px]'>Last Synchronized:</span>
                                        <span className='font-semibold text-slate-800'>{new Date(terminal.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>

                                <div className='flex items-center justify-end gap-2 pt-2 border-t border-slate-100'>
                                    <button
                                        type='button'
                                        onClick={() => handleTestConnectivity(terminal)}
                                        className='px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer'
                                    >
                                        Test Connectivity
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => handleToggleDeviceStatus(terminal)}
                                        className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition cursor-pointer ${terminal.status === 'Active' ? 'border border-amber-200 text-amber-700 hover:bg-amber-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                                    >
                                        {terminal.status === 'Active' ? 'Deactivate' : 'Activate'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 4: SYNC AUDIT HISTORY */}
            {activeTab === 'logs' && (
                <div className='rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden'>
                    <div className='p-4 border-b border-slate-100 flex items-center justify-between'>
                        <div>
                            <h3 className='text-sm font-bold text-slate-900'>POS Synchronization Execution Audit Trail</h3>
                            <p className='text-xs text-slate-500'>Complete ledger of automated and manual sync executions, records fetched, and execution timings.</p>
                        </div>
                    </div>

                    <div className='overflow-x-auto'>
                        <table className='w-full text-xs text-left'>
                            <thead className='bg-slate-50 text-slate-600 font-semibold border-b border-slate-200'>
                                <tr>
                                    <th className='px-4 py-3'>Execution ID / Time</th>
                                    <th className='px-4 py-3'>Terminal / Device</th>
                                    <th className='px-4 py-3'>Trigger Source</th>
                                    <th className='px-4 py-3 text-center'>Polled / Synced</th>
                                    <th className='px-4 py-3'>Status</th>
                                    <th className='px-4 py-3'>Execution Details</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-slate-100'>
                                {syncLogs.map((log) => (
                                    <tr key={log.id} className='hover:bg-slate-50/80 transition-colors'>
                                        <td className='px-4 py-3'>
                                            <span className='font-mono font-bold text-slate-900'>{log.id}</span>
                                            <span className='block text-[11px] text-slate-400'>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(log.timestamp).toLocaleDateString()}</span>
                                        </td>
                                        <td className='px-4 py-3 font-semibold text-slate-800 max-w-[200px] truncate'>
                                            {log.terminalName}
                                        </td>
                                        <td className='px-4 py-3 text-slate-600'>{log.initiatedBy}</td>
                                        <td className='px-4 py-3 text-center font-bold text-slate-900'>
                                            {log.syncedCount} / {log.polledCount}
                                        </td>
                                        <td className='px-4 py-3'>
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${log.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3 text-slate-600 max-w-sm'>
                                            {log.details}
                                            <span className='block text-[10px] text-slate-400'>Response time: {log.durationMs}ms</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ADD DEVICE MODAL */}
            {isAddDeviceOpen && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4'>
                    <div className='bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto'>
                        <div className='flex items-center justify-between border-b border-slate-100 pb-3'>
                            <h3 className='text-base font-bold text-slate-900 flex items-center gap-2'>
                                <Smartphone className='text-blue-600' size={18} /> Register POS / EDC Terminal
                            </h3>
                            <button
                                type='button'
                                onClick={() => setIsAddDeviceOpen(false)}
                                className='text-slate-400 hover:text-slate-600 cursor-pointer'
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAddDeviceSubmit} className='space-y-3.5 text-xs'>
                            <div>
                                <label className='block font-semibold text-slate-700 mb-1'>Terminal Identifier (TID) *</label>
                                <input
                                    type='text'
                                    required
                                    value={newDevice.terminalId}
                                    onChange={(e) => setNewDevice({ ...newDevice, terminalId: e.target.value })}
                                    placeholder='e.g. PTM-TID-8823'
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-blue-600'
                                />
                            </div>

                            <div>
                                <label className='block font-semibold text-slate-700 mb-1'>Device Name / Descriptor *</label>
                                <input
                                    type='text'
                                    required
                                    value={newDevice.name}
                                    onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                                    placeholder='e.g. Fee Counter 3 — Paytm All-in-One'
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-blue-600'
                                />
                            </div>

                            <div className='grid grid-cols-2 gap-3'>
                                <div>
                                    <label className='block font-semibold text-slate-700 mb-1'>Provider</label>
                                    <select
                                        value={newDevice.provider}
                                        onChange={(e) => setNewDevice({ ...newDevice, provider: e.target.value })}
                                        className='w-full rounded-xl border border-slate-200 px-3 py-2 text-xs'
                                    >
                                        <option value='Paytm Payments Bank / EDC'>Paytm Payments Bank / EDC</option>
                                        <option value='PineLabs EDC Gateway'>PineLabs EDC Gateway</option>
                                        <option value='State Bank of India Merchant POS'>State Bank of India</option>
                                        <option value='HDFC SmartHub POS'>HDFC SmartHub</option>
                                    </select>
                                </div>
                                <div>
                                    <label className='block font-semibold text-slate-700 mb-1'>Device Model</label>
                                    <input
                                        type='text'
                                        value={newDevice.model}
                                        onChange={(e) => setNewDevice({ ...newDevice, model: e.target.value })}
                                        placeholder='Paytm T500 / PineLabs Plutus'
                                        className='w-full rounded-xl border border-slate-200 px-3 py-2 text-xs'
                                    />
                                </div>
                            </div>

                            <div className='grid grid-cols-2 gap-3'>
                                <div>
                                    <label className='block font-semibold text-slate-700 mb-1'>Counter Location</label>
                                    <input
                                        type='text'
                                        value={newDevice.counterLocation}
                                        onChange={(e) => setNewDevice({ ...newDevice, counterLocation: e.target.value })}
                                        placeholder='e.g. Senior Accounts Desk'
                                        className='w-full rounded-xl border border-slate-200 px-3 py-2 text-xs'
                                    />
                                </div>
                                <div>
                                    <label className='block font-semibold text-slate-700 mb-1'>Assigned Cashier</label>
                                    <input
                                        type='text'
                                        value={newDevice.assignedOperator}
                                        onChange={(e) => setNewDevice({ ...newDevice, assignedOperator: e.target.value })}
                                        placeholder='e.g. M. Sridhar'
                                        className='w-full rounded-xl border border-slate-200 px-3 py-2 text-xs'
                                    />
                                </div>
                            </div>

                            <div>
                                <label className='block font-semibold text-slate-700 mb-1'>Hardware Serial Number</label>
                                <input
                                    type='text'
                                    value={newDevice.serialNumber}
                                    onChange={(e) => setNewDevice({ ...newDevice, serialNumber: e.target.value })}
                                    placeholder='e.g. SN-PTM-2025-9988'
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-xs'
                                />
                            </div>

                            <div className='flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100'>
                                <button
                                    type='button'
                                    onClick={() => setIsAddDeviceOpen(false)}
                                    className='px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='submit'
                                    className='px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition shadow-sm'
                                >
                                    Register Terminal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RECONCILE MODAL */}
            {isReconcileModalOpen && selectedTxnForRecon && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4'>
                    <div className='bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4'>
                        <div className='flex items-center justify-between border-b border-slate-100 pb-3'>
                            <h3 className='text-base font-bold text-slate-900 flex items-center gap-2'>
                                <ArrowRightLeft className='text-blue-600' size={18} /> Reconcile POS Swipe
                            </h3>
                            <button
                                type='button'
                                onClick={() => setIsReconcileModalOpen(false)}
                                className='text-slate-400 hover:text-slate-600 cursor-pointer'
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className='bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5'>
                            <div className='flex justify-between'>
                                <span className='text-slate-500'>Bank RRN:</span>
                                <span className='font-mono font-bold text-slate-900'>{selectedTxnForRecon.transactionRef}</span>
                            </div>
                            <div className='flex justify-between'>
                                <span className='text-slate-500'>Swipe Amount:</span>
                                <span className='font-bold text-slate-900'>₹{Number(selectedTxnForRecon.amount).toLocaleString('en-IN')}</span>
                            </div>
                            <div className='flex justify-between'>
                                <span className='text-slate-500'>Terminal:</span>
                                <span>{selectedTxnForRecon.terminalId}</span>
                            </div>
                            <div className='flex justify-between'>
                                <span className='text-slate-500'>Method:</span>
                                <span>{selectedTxnForRecon.paymentMethod}</span>
                            </div>
                        </div>

                        <form onSubmit={handleSaveReconciliation} className='space-y-3.5 text-xs'>
                            <div>
                                <label className='block font-semibold text-slate-700 mb-1'>Link to Student Fee Invoice ID *</label>
                                <input
                                    type='text'
                                    required
                                    value={manualInvoiceId}
                                    onChange={(e) => setManualInvoiceId(e.target.value)}
                                    placeholder='e.g. INV-2025-Q1-1042'
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-blue-600'
                                />
                            </div>

                            <div>
                                <label className='block font-semibold text-slate-700 mb-1'>Reconciliation Audit Note</label>
                                <textarea
                                    rows={2}
                                    value={manualReconNotes}
                                    onChange={(e) => setManualReconNotes(e.target.value)}
                                    placeholder='Verified against student ledger and cleared by Account Head'
                                    className='w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-blue-600'
                                />
                            </div>

                            <div className='flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100'>
                                <button
                                    type='button'
                                    onClick={() => setIsReconcileModalOpen(false)}
                                    className='px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='submit'
                                    className='px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition shadow-sm'
                                >
                                    Match & Reconcile
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    )
}
