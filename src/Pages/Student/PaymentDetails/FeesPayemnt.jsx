import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { History, Smartphone, RotateCcw, Plus, X } from 'lucide-react'
import { toast } from 'react-toastify'
import { useFinance } from '../../AccountHead/financeDomain/FinanceContext'
import { DEFAULT_ACADEMIC_YEAR } from '../../AccountHead/financeDomain/financeConstants'
import {
    formatCurrency,
    groupInstallmentsByMonth,
    hydrateInstallment,
    summarizeStudentFees,
} from '../../AccountHead/financeDomain/financeHelpers'
import { getFineRuleForCategory } from '../../AccountHead/financeDomain/financeMasters'
import FeeInstallmentCard from '../../AccountHead/FeesManagement/Components/FeeInstallmentCard'
import CheckoutMockModal from '../../AccountHead/FeesManagement/Components/CheckoutMockModal'
import PaymentHistoryDrawer from '../../AccountHead/FeesManagement/Components/PaymentHistoryDrawer'
import ReceiptDetailsDrawer from '../../AccountHead/FeesManagement/Components/ReceiptDetailsDrawer'
import StudentFeeSummary from '../../AccountHead/FeesManagement/Components/StudentFeeSummary'
import { useActiveStudent } from '../../../context/ActiveStudentContext'
import EntryClosureGate from '../../../Common/demoDomain/EntryClosureGate'
import { entryBlocked } from '../../../Common/demoDomain/governance'
import { feeService } from '../../../services/modules/feeService'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { getMyFees, payMyFeesApi } from '../../../services/api/financeApiService'
import IntegrationNotice from '../../../Common/ui/IntegrationNotice'

const matchStudentRow = (row, activeStudent) => {
    if (!row || !activeStudent) return false
    const admissionNumber = activeStudent.admissionNumber || activeStudent.admissionNo
    return (
        String(row.id) === String(activeStudent.id)
        || (admissionNumber && (row.admissionNo === admissionNumber || row.admissionNumber === admissionNumber))
        || (activeStudent.name && row.name === activeStudent.name)
    )
}

const FeesPayemnt = () => {
    const live = isLiveApiEnabled()
    const {
        students,
        getInstallmentsForStudent,
        getStudentSummary,
        collectFeePayment,
        receipts,
        reprintReceipt,
        sendReceipt,
        fineRules = [],
    } = useFinance()

    const { activeStudent } = useActiveStudent()
    const admissionNumber = activeStudent?.admissionNumber || activeStudent?.admissionNo

    const [myFeesData, setMyFeesData] = useState(null)
    const [feesLoading, setFeesLoading] = useState(Boolean(live))
    const [feesSource, setFeesSource] = useState(live ? 'backend' : 'local')
    const [feesError, setFeesError] = useState('')

    const contextStudent = students.find((item) => (
        item.id === activeStudent?.id
        || item.admissionNo === admissionNumber
        || item.admissionNumber === admissionNumber
    )) || null

    const liveStudent = useMemo(() => {
        if (!myFeesData) return null
        const list = Array.isArray(myFeesData.students) ? myFeesData.students : []
        return list.find((row) => matchStudentRow(row, activeStudent)) || list[0] || null
    }, [myFeesData, activeStudent])

    const student = live ? liveStudent : contextStudent

    const [academicYear] = useState(student?.academicYear || DEFAULT_ACADEMIC_YEAR)
    const [view, setView] = useState('pay')
    const [selectedIds, setSelectedIds] = useState([])
    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [receipt, setReceipt] = useState(null)

    const [refundRequests, setRefundRequests] = useState([])
    const [loadingRefunds, setLoadingRefunds] = useState(false)
    const [refundModalOpen, setRefundModalOpen] = useState(false)
    const [submittingRefund, setSubmittingRefund] = useState(false)
    const [refundForm, setRefundForm] = useState({
        refundCategory: 'Tuition Excess',
        refundAmount: '',
        reason: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        accountHolder: '',
    })

    const loadMyFees = useCallback(async () => {
        if (!isLiveApiEnabled()) return
        setFeesLoading(true)
        setFeesError('')
        const res = await getMyFees()
        setFeesLoading(false)
        if (!res.success) {
            setFeesSource('error')
            setFeesError(typeof res.error === 'string' ? res.error : 'Failed to load fee ledger.')
            setMyFeesData(null)
            return
        }
        setMyFeesData(res.data && typeof res.data === 'object' ? res.data : {})
        setFeesSource('backend')
    }, [])

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setFeesSource('local')
            setFeesLoading(false)
            setFeesError('')
            return
        }
        loadMyFees()
    }, [loadMyFees])

    const loadRefunds = useCallback(async () => {
        if (!student?.id) return
        setLoadingRefunds(true)
        try {
            const res = await feeService.getRefundRequests({ studentId: student.id })
            if (res.success && Array.isArray(res.data)) {
                setRefundRequests(res.data.filter((r) => !r.studentId || r.studentId === student.id))
            }
        } catch (err) {
            console.error('Failed to load student refund requests:', err)
        } finally {
            setLoadingRefunds(false)
        }
    }, [student?.id])

    useEffect(() => {
        if (view === 'refunds') {
            loadRefunds()
        }
    }, [view, loadRefunds])

    const handleRequestRefund = async (e) => {
        e.preventDefault()
        if (!refundForm.refundAmount || Number(refundForm.refundAmount) <= 0) {
            toast.error('Please enter a valid refund amount')
            return
        }
        if (!refundForm.reason.trim()) {
            toast.error('Please provide a reason for the refund')
            return
        }
        setSubmittingRefund(true)
        try {
            const res = await feeService.requestRefund({
                studentId: student?.id,
                studentName: student?.name || activeStudent?.name || 'Student',
                refundAmount: Number(refundForm.refundAmount),
                refundCategory: refundForm.refundCategory,
                reason: refundForm.reason.trim(),
                requesterRole: 'student',
                requesterName: student?.name || 'Student',
                beneficiaryBankDetails: {
                    bankName: refundForm.bankName || 'State Bank of India',
                    accountHolder: refundForm.accountHolder || student?.name || 'Student',
                    accountNumber: refundForm.accountNumber || 'Pending Submission',
                    ifscCode: refundForm.ifscCode || 'Pending IFSC',
                },
            })
            if (res.success) {
                toast.success('Fee refund request submitted successfully.')
                setRefundModalOpen(false)
                setRefundForm({
                    refundCategory: 'Tuition Excess',
                    refundAmount: '',
                    reason: '',
                    bankName: '',
                    accountNumber: '',
                    ifscCode: '',
                    accountHolder: '',
                })
                await loadRefunds()
            } else {
                toast.error(res.error || 'Failed to submit refund request')
            }
        } catch (err) {
            toast.error(err.message || 'Error submitting refund request')
        } finally {
            setSubmittingRefund(false)
        }
    }

    const liveFineRules = Array.isArray(myFeesData?.fineRules) ? myFeesData.fineRules : fineRules

    const installments = useMemo(() => {
        if (!student) return []
        if (live && myFeesData) {
            const rows = (Array.isArray(myFeesData.installments) ? myFeesData.installments : [])
                .filter((row) => String(row.studentId) === String(student.id)
                    && (!academicYear || !row.academicYear || row.academicYear === academicYear))
            return rows.map((row) => hydrateInstallment(row, {
                fineRule: getFineRuleForCategory(liveFineRules, row.feeCategoryId),
            }))
        }
        return getInstallmentsForStudent(student.id, academicYear)
    }, [student, live, myFeesData, academicYear, liveFineRules, getInstallmentsForStudent])

    const summary = useMemo(() => {
        if (!student) return null
        if (live) return summarizeStudentFees(installments)
        return getStudentSummary(student.id, academicYear)
    }, [student, live, installments, getStudentSummary, academicYear])

    const grouped = groupInstallmentsByMonth(installments)
    const studentReceipts = live
        ? (Array.isArray(myFeesData?.receipts) ? myFeesData.receipts : []).filter((item) => String(item.studentId) === String(student?.id))
        : receipts.filter((item) => item.studentId === student?.id)

    const allocations = selectedIds.map((id) => {
        const row = installments.find((item) => item.id === id)
        return row ? { installmentId: id, amount: row.balanceAmount } : null
    }).filter(Boolean)
    const totalAmount = allocations.reduce((sum, item) => sum + item.amount, 0)

    const payNow = async (payload) => {
        if (!student || entryBlocked('Finance', activeStudent?.name || 'Student')) return { success: false }

        if (isLiveApiEnabled()) {
            const res = await payMyFeesApi({
                studentId: student.id,
                installmentIds: selectedIds,
                allocations,
                paymentMode: payload?.paymentMode || 'UPI',
                details: payload?.details || {},
                collectedBy: student.name,
            })
            if (!res.success) {
                toast.error(typeof res.error === 'string' ? res.error : 'Payment failed.')
                return { success: false, errors: [res.error] }
            }
            setSelectedIds([])
            if (res.data?.receipt) setReceipt(res.data.receipt)
            await loadMyFees()
            return { success: true, receipt: res.data?.receipt || null }
        }

        const result = await collectFeePayment({
            studentId: student.id,
            allocations,
            ...payload,
            collectedBy: student.name,
        })
        if (result?.success) {
            setSelectedIds([])
            if (result.receipt) setReceipt(result.receipt)
        } else {
            toast.error(result?.errors?.[0] || 'Payment failed.')
        }
        return result
    }

    return (
        <section className='space-y-6'>
            {feesSource === 'backend' ? (
                <IntegrationNotice
                    state='connected'
                    title='Live my-fees ledger'
                    description='Hydrated from GET /api/v1/finance/my-fees. Payments use pay-my-fees (not Account Head collect).'
                />
            ) : feesSource === 'error' ? (
                <IntegrationNotice
                    state='failed'
                    title='Fees API unavailable'
                    description={feesError || 'Could not load the scoped fee ledger.'}
                />
            ) : (
                <IntegrationNotice
                    state='mock'
                    title='Browser fee payment'
                    description='Fee ledger and payments use the demo FinanceContext in this browser.'
                />
            )}

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex gap-6 border-b border-[#F2F4F7]'>
                    {[
                        { id: 'pay', label: 'Make Payment' },
                        { id: 'history', label: 'Transaction History' },
                        { id: 'refunds', label: 'Refund Requests' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type='button'
                            onClick={() => setView(tab.id)}
                            className={`pb-3 text-sm font-medium cursor-pointer ${view === tab.id ? 'text-[#515DEF] border-b-2 border-[#515DEF]' : 'text-[#808080]'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className='mt-4'>
                    <select value={academicYear} readOnly className='w-full max-w-xs text-sm border border-[#D9D9D9] rounded-md px-3 py-2.5'>
                        <option>{academicYear}</option>
                    </select>
                </div>
            </div>

            <EntryClosureGate moduleName='Finance' actor={activeStudent?.name || 'Student'} />

            {feesLoading ? (
                <div className='bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]'>
                    Loading fee information…
                </div>
            ) : null}

            {!feesLoading && !student && (
                <div className='bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]'>
                    Fee information is not available for the selected student.
                </div>
            )}
            {view === 'pay' && student && !feesLoading && (
                <>
                    <StudentFeeSummary summary={summary} />
                    {grouped.map((group) => (
                        <div key={group.label} className='space-y-3'>
                            <h3 className='text-base font-semibold'>{group.label}</h3>
                            {group.items.map((item) => (
                                <FeeInstallmentCard
                                    key={item.id}
                                    installment={item}
                                    selected={selectedIds.includes(item.id)}
                                    onToggle={(row) => {
                                        if (!row.payable) return
                                        setSelectedIds((prev) => prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id])
                                    }}
                                />
                            ))}
                        </div>
                    ))}
                    <div className='bg-white rounded-2xl shadow-md p-4 flex items-center justify-between gap-3'>
                        <p className='font-semibold'>Total Amount {formatCurrency(totalAmount)}</p>
                        <div className='flex gap-2'>
                            <button type='button' onClick={() => setHistoryOpen(true)} className='inline-flex items-center gap-2 text-sm border border-[#515DEF] text-[#515DEF] px-3 py-2 rounded-md cursor-pointer'>
                                <History size={14} /> History
                            </button>
                            <button
                                type='button'
                                disabled={!totalAmount}
                                onClick={() => setCheckoutOpen(true)}
                                className='inline-flex items-center gap-2 bg-[#FF9800] text-white px-4 py-2 rounded-md cursor-pointer disabled:opacity-50'
                            >
                                <Smartphone size={16} /> Pay Now
                            </button>
                        </div>
                    </div>
                </>
            )}

            {view === 'history' && student && !feesLoading && (
                <div className='bg-white rounded-2xl shadow-md p-4 space-y-3'>
                    {studentReceipts.length === 0 && <p className='text-sm text-[#667085]'>No transactions yet.</p>}
                    {studentReceipts.map((item) => (
                        <button key={item.id} type='button' onClick={() => setReceipt(item)} className='w-full text-left border border-[#EDEEF5] rounded-xl p-3 cursor-pointer'>
                            <p className='font-medium'>{item.receiptNo}</p>
                            <p className='text-sm text-[#667085]'>{formatCurrency(item.amountPaid)} · {item.paymentMode}</p>
                        </button>
                    ))}
                </div>
            )}

            {view === 'refunds' && student && (
                <div className='bg-white rounded-2xl shadow-md p-5 space-y-4'>
                    <IntegrationNotice
                        state='mock'
                        title='Refunds remain browser mock'
                        description='Fee refund requests are not wired to the live finance API in Phase-1.'
                    />
                    <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#F2F4F7] pb-4'>
                        <div>
                            <h3 className='text-base font-semibold text-[var(--erp-ink)]'>Fee Refund Applications</h3>
                            <p className='text-xs text-[var(--erp-muted)]'>
                                Governed 6-stage lifecycle with JD and accounts approvals for excess fees, caution deposit & hostel credits.
                            </p>
                        </div>
                        <button
                            type='button'
                            onClick={() => setRefundModalOpen(true)}
                            className='inline-flex items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 py-2 text-sm font-semibold text-white cursor-pointer hover:opacity-90'
                        >
                            <Plus size={16} /> Request Fee Refund
                        </button>
                    </div>

                    {loadingRefunds ? (
                        <div className='py-8 text-center text-sm text-[var(--erp-muted)]'>Loading refund status...</div>
                    ) : refundRequests.length === 0 ? (
                        <div className='rounded-xl border border-dashed border-[var(--erp-line-strong)] p-8 text-center'>
                            <RotateCcw className='mx-auto mb-2 text-[var(--erp-muted)]' size={32} />
                            <p className='text-sm font-semibold text-[var(--erp-ink)]'>No refund requests submitted</p>
                            <p className='mt-1 text-xs text-[var(--erp-muted)]'>
                                If you have excess payments, caution deposits, or cancelled transport/hostel terms, submit a refund claim above.
                            </p>
                        </div>
                    ) : (
                        <div className='space-y-3'>
                            {refundRequests.map((req) => (
                                <div key={req.id} className='rounded-xl border border-[var(--erp-line)] p-4 hover:border-[var(--erp-line-strong)]'>
                                    <div className='flex flex-wrap items-center justify-between gap-2'>
                                        <div>
                                            <div className='flex items-center gap-2'>
                                                <span className='font-semibold text-sm text-[var(--erp-ink)]'>{req.refundCategory || 'Fee Refund'}</span>
                                                <span className='rounded bg-[var(--erp-canvas)] px-2 py-0.5 text-xs text-[var(--erp-muted)]'>{req.refundVoucherNumber || req.id}</span>
                                            </div>
                                            <p className='mt-1 text-xs text-[var(--erp-muted)]'>Reason: {req.reason}</p>
                                        </div>
                                        <div className='text-right'>
                                            <div className='text-base font-bold text-[var(--erp-ink)]'>{formatCurrency(req.refundAmount)}</div>
                                            <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                req.status === 'Disbursed' ? 'bg-[#4CAF5022] text-[#4CAF50]' :
                                                req.status === 'Approved' ? 'bg-[#515DEF22] text-[#515DEF]' :
                                                req.status === 'Rejected' ? 'bg-[#FF572222] text-[#FF5722]' :
                                                'bg-[#FF980022] text-[#FF9800]'
                                            }`}>
                                                {req.status}
                                            </span>
                                        </div>
                                    </div>
                                    {req.beneficiaryBankDetails?.bankName && (
                                        <div className='mt-3 flex flex-wrap gap-4 border-t border-[var(--erp-line)] pt-2 text-xs text-[var(--erp-muted)]'>
                                            <span>Bank: {req.beneficiaryBankDetails.bankName}</span>
                                            <span>A/C: {req.beneficiaryBankDetails.accountNumber}</span>
                                            <span>IFSC: {req.beneficiaryBankDetails.ifscCode}</span>
                                            {req.disbursementMode && (
                                                <span className='font-semibold text-[var(--erp-indigo)]'>Disbursed via {req.disbursementMode} ({req.disbursementReference || req.chequeNumber})</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {refundModalOpen && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
                    <div className='w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl'>
                        <div className='flex items-center justify-between border-b border-[var(--erp-line)] pb-3'>
                            <h3 className='text-base font-semibold text-[var(--erp-ink)]'>Request Fee Refund</h3>
                            <button
                                type='button'
                                onClick={() => setRefundModalOpen(false)}
                                className='rounded p-1 text-[var(--erp-muted)] hover:bg-[var(--erp-canvas)]'
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleRequestRefund} className='mt-4 space-y-4'>
                            <div>
                                <label className='block text-xs font-medium text-[var(--erp-muted)]'>Refund Category</label>
                                <select
                                    value={refundForm.refundCategory}
                                    onChange={(e) => setRefundForm({ ...refundForm, refundCategory: e.target.value })}
                                    className='mt-1 w-full rounded-lg border border-[var(--erp-line-strong)] px-3 py-2 text-sm'
                                >
                                    <option value='Tuition Excess'>Tuition Excess / Double Payment</option>
                                    <option value='Caution Deposit'>Caution Deposit / Security Clearance</option>
                                    <option value='Hostel Fee Adjustment'>Hostel Vacate / Room Fee Credit</option>
                                    <option value='Transport Cancellation'>Transport Cancellation</option>
                                    <option value='Activity Withdrawal'>Extracurricular Activity Fee</option>
                                </select>
                            </div>
                            <div>
                                <label className='block text-xs font-medium text-[var(--erp-muted)]'>Claim Amount (₹)</label>
                                <input
                                    type='number'
                                    required
                                    min='1'
                                    placeholder='e.g. 5000'
                                    value={refundForm.refundAmount}
                                    onChange={(e) => setRefundForm({ ...refundForm, refundAmount: e.target.value })}
                                    className='mt-1 w-full rounded-lg border border-[var(--erp-line-strong)] px-3 py-2 text-sm'
                                />
                            </div>
                            <div>
                                <label className='block text-xs font-medium text-[var(--erp-muted)]'>Reason / Justification</label>
                                <textarea
                                    required
                                    rows={2}
                                    placeholder='Specify why refund is requested and any transaction or clearance reference...'
                                    value={refundForm.reason}
                                    onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                                    className='mt-1 w-full rounded-lg border border-[var(--erp-line-strong)] px-3 py-2 text-sm'
                                />
                            </div>
                            <div className='rounded-lg bg-[var(--erp-canvas)] p-3 space-y-2'>
                                <p className='text-xs font-semibold text-[var(--erp-ink)]'>Beneficiary Bank Account Details</p>
                                <div className='grid grid-cols-2 gap-2'>
                                    <div>
                                        <label className='block text-[11px] text-[var(--erp-muted)]'>Account Holder Name</label>
                                        <input
                                            type='text'
                                            placeholder={student?.name || 'Account Holder'}
                                            value={refundForm.accountHolder}
                                            onChange={(e) => setRefundForm({ ...refundForm, accountHolder: e.target.value })}
                                            className='mt-1 w-full rounded border border-[var(--erp-line-strong)] px-2 py-1.5 text-xs'
                                        />
                                    </div>
                                    <div>
                                        <label className='block text-[11px] text-[var(--erp-muted)]'>Bank Name</label>
                                        <input
                                            type='text'
                                            placeholder='e.g. HDFC Bank'
                                            value={refundForm.bankName}
                                            onChange={(e) => setRefundForm({ ...refundForm, bankName: e.target.value })}
                                            className='mt-1 w-full rounded border border-[var(--erp-line-strong)] px-2 py-1.5 text-xs'
                                        />
                                    </div>
                                    <div>
                                        <label className='block text-[11px] text-[var(--erp-muted)]'>Account Number</label>
                                        <input
                                            type='text'
                                            placeholder='Account No.'
                                            value={refundForm.accountNumber}
                                            onChange={(e) => setRefundForm({ ...refundForm, accountNumber: e.target.value })}
                                            className='mt-1 w-full rounded border border-[var(--erp-line-strong)] px-2 py-1.5 text-xs'
                                        />
                                    </div>
                                    <div>
                                        <label className='block text-[11px] text-[var(--erp-muted)]'>IFSC Code</label>
                                        <input
                                            type='text'
                                            placeholder='e.g. HDFC0001234'
                                            value={refundForm.ifscCode}
                                            onChange={(e) => setRefundForm({ ...refundForm, ifscCode: e.target.value.toUpperCase() })}
                                            className='mt-1 w-full rounded border border-[var(--erp-line-strong)] px-2 py-1.5 text-xs uppercase'
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className='flex justify-end gap-3 pt-2'>
                                <button
                                    type='button'
                                    onClick={() => setRefundModalOpen(false)}
                                    className='rounded-lg border border-[var(--erp-line-strong)] px-4 py-2 text-sm font-semibold text-[var(--erp-muted)] hover:bg-[var(--erp-canvas)]'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='submit'
                                    disabled={submittingRefund}
                                    className='rounded-lg bg-[var(--erp-indigo)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50'
                                >
                                    {submittingRefund ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <CheckoutMockModal
                isOpen={checkoutOpen}
                onClose={() => setCheckoutOpen(false)}
                amount={totalAmount}
                student={student}
                onSuccess={payNow}
            />
            <PaymentHistoryDrawer
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                receipts={studentReceipts}
                onViewReceipt={(row) => { setReceipt(row); setHistoryOpen(false) }}
            />
            <ReceiptDetailsDrawer
                isOpen={Boolean(receipt)}
                onClose={() => setReceipt(null)}
                receipt={receipt}
                student={student}
                onReprint={reprintReceipt}
                onSend={sendReceipt}
                onPrint={() => window.print()}
            />
        </section>
    )
}

export default FeesPayemnt
