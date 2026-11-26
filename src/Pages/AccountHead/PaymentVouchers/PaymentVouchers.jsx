import { useState, useEffect, useMemo, useCallback } from 'react'
import { Download, Printer, X, FileText, ShoppingCart, UserCheck, Layers, Undo2 } from 'lucide-react'
import { DataTable, IntegrationNotice, PageHeader, StatusBadge } from '../../../Common/ui'
import { openPrintDocument } from '../../../Common/printDocument'
import { useFinance } from '../financeDomain/FinanceContext'
import { formatCurrency } from '../financeDomain/financeHelpers'
import { purchaseService } from '../../../services/modules/purchaseService'
import { listPaymentVouchersApi, payVendorLiabilityApi } from '../../../services/api/paymentVoucherApiService.js'
import { isLiveApiEnabled } from '../../../services/api/tokenStore.js'

const escapeHtml = (value) => String(value ?? '—')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const isPayrollTxn = (transaction) => String(transaction?.sourceModule || '').toUpperCase() === 'PAYROLL'

const isPayrollReversal = (transaction) => {
    if (!isPayrollTxn(transaction)) return false
    if (String(transaction?.voucherType || '').toLowerCase() === 'reversal') return true
    if (String(transaction?.entryType || '').toLowerCase() === 'reversal') return true
    if (transaction?.reversesTransactionId) return true
    const id = String(transaction?.id || '')
    const voucherNo = String(transaction?.voucherNo || '')
    return id.startsWith('REV-') || voucherNo.startsWith('RV-')
}

const isPayrollPayment = (transaction) => isPayrollTxn(transaction) && !isPayrollReversal(transaction)

const payeeLabel = (transaction) => {
    if (isPayrollTxn(transaction)) return 'Payee / Staff'
    if (transaction?.isVendorLiability || transaction?.voucherKind === 'vendor_payment') return 'Payee / Vendor'
    return 'Payee / Student'
}

const detailSubtitle = (transaction) => {
    if (transaction?.isVendorLiability) return 'Generated from Director approved Purchase Order'
    if (isPayrollReversal(transaction)) return 'Payroll payment reversal voucher'
    if (isPayrollPayment(transaction)) return 'HR payroll payment voucher'
    return 'Transaction-backed fee receipt'
}

const printTitle = (transaction) => {
    if (transaction?.isVendorLiability) return 'Accounts Payable Liability Voucher'
    if (isPayrollReversal(transaction)) return 'Payroll Payment Reversal Voucher'
    if (isPayrollPayment(transaction)) return 'Payroll Payment Voucher'
    return 'Payment & Fee Receipt Voucher'
}

const voucherFields = (transaction, payee) => [
    ['Voucher no.', transaction.voucherNo || '—'],
    ['Transaction reference / PO', transaction.transactionNo || transaction.id],
    ['Date', transaction.transactionDate || '—'],
    [payeeLabel(transaction), payee],
    ['Category', transaction.category || transaction.sourceModule || '—'],
    ['Payment mode', transaction.paymentMode || 'Bank Transfer / AP'],
    ['Amount', formatCurrency(transaction.amount)],
    ['Narration', transaction.narration || '—'],
    ['Prepared by', transaction.preparedBy || transaction.createdBy || 'Finance Head'],
    ['Status', transaction.voucherStatus || transaction.status || 'Issued'],
    ...(transaction.dueDate ? [['Payment due date', transaction.dueDate]] : []),
    ...(transaction.reversesTransactionId ? [['Reverses', transaction.reversesTransactionId]] : []),
]

const voucherPrintBody = (transaction, payee) => `
    <header style="margin-bottom:20px;border-bottom:2px solid #1E293B;padding-bottom:12px;">
        <p style="font-size:12px;color:#667085;margin:0;">Queen Mira International School • Central Accounts & Treasury</p>
        <h1 style="font-size:22px;margin-top:6px;margin-bottom:2px;">${printTitle(transaction)}</h1>
        <p style="font-size:11px;color:#475569;margin:0;">Voucher Reference: ${escapeHtml(transaction.voucherNo || transaction.id)}</p>
    </header>
    <table style="width:100%;border-collapse:collapse;">
        <tbody>${voucherFields(transaction, payee).map(([label, value]) => `<tr style="border-bottom:1px solid #E2E8F0;"><th style="width:36%;text-align:left;padding:8px 0;font-size:12px;color:#64748B;">${escapeHtml(label)}</th><td style="padding:8px 0;font-size:13px;font-weight:600;color:#0F172A;">${escapeHtml(value)}</td></tr>`).join('')}</tbody>
    </table>
    <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:11px;color:#64748B;">
        <div>_______________________<br>Prepared by (Finance)</div>
        <div>_______________________<br>Verified (Internal Audit)</div>
        <div>_______________________<br>Authorised Signatory</div>
    </div>
    <p style="margin-top:24px;font-size:10px;color:#94A3B8;">Official Institutional ERP Ledger Posting. Verify against primary purchase order or bank statement before disbursement.</p>
`

export default function PaymentVouchers() {
    const { transactions: ctxTransactions = [], students = [], recordVoucherAction, rehydrateFromApi } = useFinance()
    const live = isLiveApiEnabled()
    const [selectedId, setSelectedId] = useState(null)
    const [liabilities, setLiabilities] = useState([])
    const [apiData, setApiData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [payingId, setPayingId] = useState(null)
    const [voucherTab, setVoucherTab] = useState('all') // 'all' | 'students' | 'vendors' | 'payroll' | 'payroll-reversals'

    const refresh = useCallback(async () => {
        if (!live) return
        setLoading(true)
        setError('')
        const res = await listPaymentVouchersApi()
        if (!res.success) {
            setError(res.error || 'Could not load payment vouchers.')
        } else {
            setApiData(res.data)
        }
        setLoading(false)
    }, [live])

    useEffect(() => {
        if (live) {
            refresh()
            return undefined
        }
        const loadLiabilities = async () => {
            try {
                const res = await purchaseService.getFinanceLiabilities()
                if (res?.success && Array.isArray(res.data)) {
                    setLiabilities(res.data)
                }
            } catch (err) {
                console.warn('Could not fetch finance liabilities from purchase service:', err)
            }
        }
        loadLiabilities()
        return undefined
    }, [live, refresh])

    const payVendor = async (row) => {
        setPayingId(row.id)
        setError('')
        setNotice('')
        const res = await payVendorLiabilityApi({ liabilityId: row.id, paymentMode: 'BANK_TRANSFER' })
        setPayingId(null)
        if (!res.success) {
            setError(res.error || 'Vendor payment failed.')
            return
        }
        setNotice(
            res.data?.skipped
                ? 'Liability was already paid — no duplicate voucher created.'
                : `Vendor payment posted as voucher ${res.data?.voucherNo || ''}.`,
        )
        await refresh()
        if (typeof rehydrateFromApi === 'function') rehydrateFromApi()
    }

    // In live mode the voucher register comes from the API; otherwise from the browser finance snapshot.
    const transactions = useMemo(
        () => (live
            ? [...(apiData?.fees || []), ...(apiData?.vendorPayments || []), ...(apiData?.payroll || []), ...(apiData?.payrollReversals || [])]
            : ctxTransactions),
        [live, apiData, ctxTransactions],
    )

    const mappedLiabilities = useMemo(() => {
        if (live) return apiData?.vendorLiabilities || []
        return liabilities.map((l) => ({
            id: l.id,
            voucherNo: l.voucherNumber,
            transactionNo: l.poNumber,
            transactionDate: l.generatedDate,
            payee: l.payeeName,
            category: l.liabilityAccount || 'Accounts Payable - Laboratory & Campus Stores',
            amount: l.amountDue,
            status: l.status || 'Pending Payment',
            voucherStatus: l.status || 'Pending Payment',
            paymentMode: 'Bank Transfer / AP Cheque',
            narration: `Purchase Order ${l.poNumber} liability payable to ${l.payeeName}. Due date: ${l.dueDate}.`,
            preparedBy: 'Procurement & Finance Approvals',
            isVendorLiability: true,
            dueDate: l.dueDate,
            poId: l.poId,
        }))
    }, [live, apiData, liabilities])

    const payrollPayments = useMemo(
        () => (transactions || []).filter((t) => isPayrollPayment(t)),
        [transactions],
    )

    const payrollReversals = useMemo(
        () => (transactions || []).filter((t) => isPayrollReversal(t)),
        [transactions],
    )

    const allVouchers = useMemo(() => {
        if (voucherTab === 'students') {
            return (transactions || []).filter((t) => !isPayrollTxn(t))
        }
        if (voucherTab === 'vendors') return mappedLiabilities
        if (voucherTab === 'payroll') return payrollPayments
        if (voucherTab === 'payroll-reversals') return payrollReversals
        return [...mappedLiabilities, ...transactions]
    }, [voucherTab, transactions, mappedLiabilities, payrollPayments, payrollReversals])

    const selected = allVouchers.find((item) => item.id === selectedId) || null

    const payeeFor = (transaction) => {
        if (isPayrollTxn(transaction)) {
            return transaction.employeeName || transaction.employeeId || 'Staff payroll'
        }
        if (transaction?.isVendorLiability || transaction?.payee) {
            return transaction.payee || transaction.payeeName || 'Vendor / Stores Supplier'
        }
        return students.find((item) => item.id === transaction?.studentId)?.name || transaction?.vendorId || 'Not linked'
    }

    const safeRecordVoucherAction = (id, action) => {
        try {
            if (typeof recordVoucherAction === 'function') {
                recordVoucherAction(id, action)
            }
        } catch (e) {
            // Ignore if ID is a vendor liability rather than finance transaction
        }
    }

    const download = (transaction) => {
        safeRecordVoucherAction(transaction.id, 'Download')
        const text = voucherFields(transaction, payeeFor(transaction)).map(([label, value]) => `${label}: ${value}`).join('\n')
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${transaction.voucherNo || transaction.id}.txt`
        link.click()
        URL.revokeObjectURL(url)
    }

    const print = (transaction) => {
        safeRecordVoucherAction(transaction.id, 'Print')
        openPrintDocument({
            title: transaction.isVendorLiability ? 'Accounts Payable Voucher' : printTitle(transaction),
            body: voucherPrintBody(transaction, payeeFor(transaction))
        })
    }

    const columns = [
        {
            key: 'voucherNo',
            label: 'Voucher',
            required: true,
            render: (row) => (
                <div className='flex items-center gap-2'>
                    <span className='font-semibold text-[var(--erp-ink)]'>{row.voucherNo || 'Not assigned'}</span>
                    {row.isVendorLiability && (
                        <span className='px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 uppercase'>
                            Vendor AP
                        </span>
                    )}
                    {isPayrollPayment(row) && (
                        <span className='px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase'>
                            Payroll
                        </span>
                    )}
                    {isPayrollReversal(row) && (
                        <span className='px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase'>
                            Reversal
                        </span>
                    )}
                </div>
            )
        },
        { key: 'transactionNo', label: 'Reference / PO', render: (row) => row.transactionNo || row.id },
        { key: 'transactionDate', label: 'Date' },
        { key: 'payee', label: 'Payee / Beneficiary', render: (row) => payeeFor(row) },
        {
            key: 'category',
            label: 'Ledger Category',
            render: (row) => <span className='text-xs text-slate-600 truncate max-w-[200px] block'>{row.category || 'General'}</span>
        },
        { key: 'amount', label: 'Amount', render: (row) => <span className='font-semibold text-[var(--erp-ink)]'>{formatCurrency(row.amount)}</span> },
        { key: 'voucherStatus', label: 'Status', render: (row) => <StatusBadge status={row.voucherStatus || row.status || 'Issued'} /> },
    ]

    return (
        <section className='space-y-5'>
            <PageHeader
                title='Payment Vouchers & Accounts Payable'
                description='Inspect, print or download vouchers generated from finance collections and approved purchase orders.'
                context={`${mappedLiabilities.length} vendor AP · ${payrollPayments.length} payroll · ${payrollReversals.length} reversals · ${transactions.length} finance txns`}
            />

            <div className='flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-xl max-w-fit border border-slate-200'>
                <button
                    type='button'
                    onClick={() => setVoucherTab('all')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${voucherTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    <Layers size={14} />
                    All
                </button>
                <button
                    type='button'
                    onClick={() => setVoucherTab('vendors')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${voucherTab === 'vendors' ? 'bg-white text-purple-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    <ShoppingCart size={14} className='text-purple-600' />
                    Vendor AP ({mappedLiabilities.length})
                </button>
                <button
                    type='button'
                    onClick={() => setVoucherTab('payroll')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${voucherTab === 'payroll' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    <FileText size={14} className='text-emerald-600' />
                    Payroll ({payrollPayments.length})
                </button>
                <button
                    type='button'
                    onClick={() => setVoucherTab('payroll-reversals')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${voucherTab === 'payroll-reversals' ? 'bg-white text-amber-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    <Undo2 size={14} className='text-amber-700' />
                    Payroll reversals ({payrollReversals.length})
                </button>
                <button
                    type='button'
                    onClick={() => setVoucherTab('students')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${voucherTab === 'students' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    <UserCheck size={14} className='text-blue-600' />
                    Fees / other
                </button>
            </div>

            <IntegrationNotice
                state='connected'
                title={live ? 'Live voucher register (PostgreSQL)' : 'Integrated institutional voucher register'}
                description='HR paid payroll months post Finance OUT vouchers with ledger lines. Reversal vouchers are listed separately. Vendor AP comes from approved purchase orders and can be paid here (posts a balanced GL voucher, once). Fee receipts come from campus finance transactions.'
            />
            {error ? (
                <div role='alert' className='flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
                    <span>{error}</span>
                    {live ? <button type='button' onClick={refresh} className='underline cursor-pointer'>Retry</button> : null}
                </div>
            ) : null}
            {notice ? (
                <div role='status' className='rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'>{notice}</div>
            ) : null}
            {loading ? <p className='text-sm text-[#667085]'>Loading payment vouchers from campus finance…</p> : null}

            <section className='overflow-hidden rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white'>
                <DataTable
                    caption='Payment vouchers generated from finance transactions and procurement orders'
                    rows={allVouchers}
                    columns={columns}
                    rowKey='id'
                    emptyTitle='No payment vouchers yet'
                    emptyDescription='No vouchers found for this category.'
                    renderActions={(row) => (
                        <button
                            type='button'
                            onClick={() => {
                                safeRecordVoucherAction(row.id, 'View')
                                setSelectedId(row.id)
                            }}
                            className='min-h-9 rounded-md border border-[var(--erp-indigo)] px-3 text-sm font-semibold text-[var(--erp-indigo)] hover:bg-indigo-50 cursor-pointer'
                        >
                            View voucher
                        </button>
                    )}
                />
            </section>

            {selected ? (
                <section className='rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white p-4 sm:p-5' aria-labelledby='voucher-detail-title'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <div className='flex items-center gap-2'>
                                <h3 id='voucher-detail-title' className='text-lg font-semibold text-[var(--erp-ink)]'>
                                    Voucher {selected.voucherNo || selected.id}
                                </h3>
                                {selected.isVendorLiability && (
                                    <span className='px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700'>
                                        Procurement AP Liability
                                    </span>
                                )}
                                {isPayrollPayment(selected) && (
                                    <span className='px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700'>
                                        Payroll payment
                                    </span>
                                )}
                                {isPayrollReversal(selected) && (
                                    <span className='px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800'>
                                        Payroll reversal
                                    </span>
                                )}
                            </div>
                            <p className='mt-1 text-xs text-[var(--erp-muted)]'>
                                {detailSubtitle(selected)} · Read only
                            </p>
                        </div>
                        <button
                            type='button'
                            onClick={() => setSelectedId(null)}
                            className='inline-flex size-9 items-center justify-center rounded-md border border-[var(--erp-line-strong)] text-[var(--erp-slate)] hover:bg-slate-100 cursor-pointer'
                            aria-label='Close voucher details'
                        >
                            <X aria-hidden='true' size={16} />
                        </button>
                    </div>
                    <dl className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                        {voucherFields(selected, payeeFor(selected)).map(([label, value]) => (
                            <div key={label} className='rounded-lg bg-[var(--erp-canvas)] p-3'>
                                <dt className='text-xs text-[var(--erp-muted)]'>{label}</dt>
                                <dd className='mt-1 break-words text-sm font-semibold text-[var(--erp-ink)]'>{value}</dd>
                            </div>
                        ))}
                    </dl>
                    <div className='mt-4 flex flex-wrap gap-2'>
                        <button
                            type='button'
                            onClick={() => print(selected)}
                            className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer'
                        >
                            <Printer aria-hidden='true' size={16} /> Print voucher
                        </button>
                        {live && selected.isVendorLiability && selected.voucherStatus !== 'Paid' ? (
                            <button
                                type='button'
                                disabled={payingId === selected.id}
                                onClick={() => payVendor(selected)}
                                className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer'
                            >
                                {payingId === selected.id ? 'Posting payment…' : 'Pay vendor & post voucher'}
                            </button>
                        ) : null}
                        <button
                            type='button'
                            onClick={() => download(selected)}
                            className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-indigo)] px-4 text-sm font-semibold text-[var(--erp-indigo)] hover:bg-indigo-50 cursor-pointer'
                        >
                            <Download aria-hidden='true' size={16} /> Download text copy
                        </button>
                    </div>
                </section>
            ) : null}
        </section>
    )
}
