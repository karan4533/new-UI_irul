import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import {
    ACTOR_FINANCE_HEAD,
    CHEQUE_STATUSES,
    DEFAULT_BANK_ACCOUNT_ID,
    PAYMENT_MODES,
    SOURCE_MODULES,
    TRANSACTION_DIRECTIONS,
    TRANSACTION_STATUSES,
} from './financeConstants'
import {
    applyPaymentToInstallments,
    calculateStudentOutstanding,
    createAccountingPosting,
    createFinanceTransaction,
    formatCurrency,
    generatePaymentReference,
    generateReceiptNo,
    generateTransactionNo,
    generateVoucherNo,
    hydrateInstallment,
    isChequePostDated,
    resolveConcessionAmount,
    summarizeStudentFees,
    toIsoDate,
    validatePaymentInput,
} from './financeHelpers'
import { BUDGET_SEED } from '../../../Common/demoDomain/financeExtras'
import {
    BANK_ACCOUNTS,
    FEE_CATEGORIES,
    FEE_CONCESSIONS,
    FEE_INSTALLMENTS,
    FEE_STRUCTURES,
    FINANCE_STUDENTS,
    FINE_RULES,
    POS_TERMINALS,
    SEED_CHEQUES,
    SEED_RECEIPTS,
    getFineRuleForCategory,
} from './financeMasters'
import {
    DEFAULT_FINANCE_SEQUENCE,
    FINANCE_STORAGE_KEY,
    clearFinanceState,
    cloneJson,
    initialPersistedList,
    loadFinanceState,
    pickPersistedSequence,
    saveFinanceState,
} from './financeStorage'
import { useAuth } from '../../../context/AuthContext'
import { getAccessToken, isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    collectPaymentApi,
    decideFinanceApprovalApi,
    getFinanceState,
    resetFinanceStateApi,
    saveFinanceStateApi,
    sendReceiptApi,
    settleChequeApi,
} from '../../../services/api/financeApiService'

const FinanceContext = createContext(null)

const EMPTY_LIST = []

function snapshotFromContext({
    students,
    feeCategories,
    feeStructures,
    fineRules,
    bankAccounts,
    posTerminals,
    concessions,
    installments,
    annualBudget,
    transactions,
    receipts,
    cheques,
    paymentLinks,
    auditLog,
    glEntries,
    dayBookEntries,
    cashBookEntries,
    bankBookEntries,
    onlineBookEntries,
    reconciliationItems,
    sequence,
    meta = { seeded: true },
}) {
    return {
        students,
        feeCategories,
        feeStructures,
        fineRules,
        bankAccounts,
        posTerminals,
        concessions,
        installments,
        annualBudget,
        chartOfAccounts: [],
        journalVouchers: [],
        bookFeeBreakup: [],
        transactions,
        receipts,
        cheques,
        paymentLinks,
        auditLog,
        glEntries,
        dayBookEntries,
        cashBookEntries,
        bankBookEntries,
        onlineBookEntries,
        reconciliationItems,
        activityFees: [],
        wallets: [],
        walletRecharges: [],
        transportFleet: [],
        transportMaintenance: [],
        transportCompliance: [],
        transportSalaries: [],
        approvals: [],
        sequence,
        meta,
    }
}

const clone = (value) => cloneJson(value)

const createSeedFinanceState = () => ({
    feeCategories: clone(FEE_CATEGORIES),
    feeStructures: clone(FEE_STRUCTURES),
    fineRules: clone(FINE_RULES),
    bankAccounts: clone(BANK_ACCOUNTS),
    posTerminals: clone(POS_TERMINALS),
    concessions: clone(FEE_CONCESSIONS),
    installments: clone(FEE_INSTALLMENTS),
    transactions: [],
    receipts: clone(SEED_RECEIPTS),
    cheques: clone(SEED_CHEQUES),
    paymentLinks: [],
    auditLog: [],
    glEntries: [],
    dayBookEntries: [],
    cashBookEntries: [],
    bankBookEntries: [],
    onlineBookEntries: [],
    reconciliationItems: [],
    sequence: { ...DEFAULT_FINANCE_SEQUENCE },
})

export const FinanceProvider = ({ children }) => {
    const live = isLiveApiEnabled()
    const { isAuthenticated, isSessionReady } = useAuth()
    const [initialSaved] = useState(() => (live ? null : loadFinanceState()))
    const saved = initialSaved?.data ?? null

    const seq = useRef(pickPersistedSequence(saved))
    const submittingRef = useRef(false)
    const skipPersistRef = useRef(false)
    const liveReadyRef = useRef(!live)
    const persistTimerRef = useRef(null)
    const lastHydratedTokenRef = useRef('')

    const [students, setStudents] = useState(() => (live ? EMPTY_LIST : FINANCE_STUDENTS))
    const [feeCategories, setFeeCategories] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'feeCategories', FEE_CATEGORIES)
    ))
    const [feeStructures, setFeeStructures] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'feeStructures', FEE_STRUCTURES)
    ))
    const [fineRules, setFineRules] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'fineRules', FINE_RULES)
    ))
    const [bankAccounts, setBankAccounts] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'bankAccounts', BANK_ACCOUNTS)
    ))
    const [posTerminals, setPosTerminals] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'posTerminals', POS_TERMINALS)
    ))
    const [concessions, setConcessions] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'concessions', FEE_CONCESSIONS)
    ))
    const [installments, setInstallments] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'installments', FEE_INSTALLMENTS)
    ))
    const [annualBudget, setAnnualBudget] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'annualBudget', BUDGET_SEED)
    ))
    const [transactions, setTransactions] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'transactions', [])
    ))
    const [receipts, setReceipts] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'receipts', SEED_RECEIPTS)
    ))
    const [cheques, setCheques] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'cheques', SEED_CHEQUES)
    ))
    const [paymentLinks, setPaymentLinks] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'paymentLinks', [])
    ))
    const [auditLog, setAuditLog] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'auditLog', [])
    ))
    const [glEntries, setGlEntries] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'glEntries', [])
    ))
    const [dayBookEntries, setDayBookEntries] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'dayBookEntries', [])
    ))
    const [cashBookEntries, setCashBookEntries] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'cashBookEntries', [])
    ))
    const [bankBookEntries, setBankBookEntries] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'bankBookEntries', [])
    ))
    const [onlineBookEntries, setOnlineBookEntries] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'onlineBookEntries', [])
    ))
    const [reconciliationItems, setReconciliationItems] = useState(() => (
        live ? EMPTY_LIST : initialPersistedList(saved, 'reconciliationItems', [])
    ))
    const [lastSavedAt, setLastSavedAt] = useState(() => initialSaved?.savedAt ?? null)
    const [liveLoading, setLiveLoading] = useState(Boolean(live))
    const [liveError, setLiveError] = useState('')
    const [liveSource, setLiveSource] = useState(live ? 'backend' : 'local')
    const [approvals, setApprovals] = useState(() => EMPTY_LIST)
    const [wallets, setWallets] = useState(() => EMPTY_LIST)
    const [walletRecharges, setWalletRecharges] = useState(() => EMPTY_LIST)
    const [transportFleet, setTransportFleet] = useState(() => EMPTY_LIST)

    const applyRemoteState = useCallback((payload) => {
        const data = payload?.data && typeof payload.data === 'object' ? payload.data : {}
        skipPersistRef.current = true
        seq.current = pickPersistedSequence(data)
        setStudents(Array.isArray(data.students) ? data.students : [])
        setFeeCategories(Array.isArray(data.feeCategories) ? data.feeCategories : [])
        setFeeStructures(Array.isArray(data.feeStructures) ? data.feeStructures : [])
        setFineRules(Array.isArray(data.fineRules) ? data.fineRules : [])
        setBankAccounts(Array.isArray(data.bankAccounts) ? data.bankAccounts : [])
        setPosTerminals(Array.isArray(data.posTerminals) ? data.posTerminals : [])
        setConcessions(Array.isArray(data.concessions) ? data.concessions : [])
        setInstallments(Array.isArray(data.installments) ? data.installments : [])
        setAnnualBudget(Array.isArray(data.annualBudget) ? data.annualBudget : [])
        setTransactions(Array.isArray(data.transactions) ? data.transactions : [])
        setReceipts(Array.isArray(data.receipts) ? data.receipts : [])
        setCheques(Array.isArray(data.cheques) ? data.cheques : [])
        setPaymentLinks(Array.isArray(data.paymentLinks) ? data.paymentLinks : [])
        setAuditLog(Array.isArray(data.auditLog) ? data.auditLog : [])
        setGlEntries(Array.isArray(data.glEntries) ? data.glEntries : [])
        setDayBookEntries(Array.isArray(data.dayBookEntries) ? data.dayBookEntries : [])
        setCashBookEntries(Array.isArray(data.cashBookEntries) ? data.cashBookEntries : [])
        setBankBookEntries(Array.isArray(data.bankBookEntries) ? data.bankBookEntries : [])
        setOnlineBookEntries(Array.isArray(data.onlineBookEntries) ? data.onlineBookEntries : [])
        setReconciliationItems(Array.isArray(data.reconciliationItems) ? data.reconciliationItems : [])
        setApprovals(Array.isArray(data.approvals) ? data.approvals : [])
        setWallets(Array.isArray(data.wallets) ? data.wallets : [])
        setWalletRecharges(Array.isArray(data.walletRecharges) ? data.walletRecharges : [])
        setTransportFleet(Array.isArray(data.transportFleet) ? data.transportFleet : [])
        setLastSavedAt(payload?.savedAt || null)
        liveReadyRef.current = true
    }, [])

    const rehydrateFromApi = useCallback(async () => {
        const res = await getFinanceState()
        if (!res.success) {
            setLiveError(typeof res.error === 'string' ? res.error : 'Failed to load finance state from the API.')
            setLiveSource('error')
            setLiveLoading(false)
            return res
        }
        applyRemoteState(res.data)
        setLiveError('')
        setLiveSource('backend')
        setLiveLoading(false)
        return res
    }, [applyRemoteState])

    useEffect(() => {
        if (!isLiveApiEnabled()) return undefined
        // Wait for Auth bootstrap so we never hit /finance/state without a JWT (401 would clear the session).
        if (!isSessionReady) {
            setLiveLoading(Boolean(isAuthenticated))
            return undefined
        }
        if (!isAuthenticated) {
            lastHydratedTokenRef.current = ''
            liveReadyRef.current = false
            setLiveError('')
            setLiveSource('backend')
            setLiveLoading(false)
            return undefined
        }
        const token = getAccessToken()
        if (!token) {
            // Authenticated UI without JWT — wait; do not call the API.
            setLiveError('Sign in required.')
            setLiveSource('error')
            setLiveLoading(false)
            liveReadyRef.current = false
            return undefined
        }
        if (token === lastHydratedTokenRef.current && liveReadyRef.current) return undefined

        let cancelled = false
        ;(async () => {
            setLiveLoading(true)
            const res = await getFinanceState()
            if (cancelled) return
            if (!res.success) {
                setLiveError(typeof res.error === 'string' ? res.error : 'Failed to load finance state from the API.')
                setLiveSource('error')
                setLiveLoading(false)
                liveReadyRef.current = false
                return
            }
            applyRemoteState(res.data)
            lastHydratedTokenRef.current = token
            setLiveError('')
            setLiveSource('backend')
            setLiveLoading(false)
        })()
        return () => {
            cancelled = true
            if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
        }
    }, [applyRemoteState, isAuthenticated, isSessionReady])

    const appendAudit = useCallback((entry) => {
        setAuditLog((prev) => [{
            id: `AUD-${Date.now()}-${prev.length}`,
            performedAt: new Date().toISOString(),
            performedBy: entry.performedBy || ACTOR_FINANCE_HEAD,
            ...entry,
        }, ...prev])
    }, [])

    const hydratedInstallments = useMemo(() => (
        installments.map((row) => hydrateInstallment({
            ...row,
            concessionAmount: resolveConcessionAmount(row, concessions),
        }, {
            fineRule: getFineRuleForCategory(fineRules, row.feeCategoryId),
            asOfDate: new Date(),
        }))
    ), [concessions, fineRules, installments])

    const getStudentById = useCallback(
        (id) => students.find((student) => student.id === id) ?? null,
        [students],
    )

    const getInstallmentsForStudent = useCallback(
        (studentId, academicYear) => hydratedInstallments.filter((row) => (
            row.studentId === studentId
            && (!academicYear || row.academicYear === academicYear)
        )),
        [hydratedInstallments],
    )

    const getSiblings = useCallback((studentId) => {
        const student = getStudentById(studentId)
        if (!student?.familyId) return []
        return students.filter((item) => item.familyId === student.familyId && item.id !== studentId)
    }, [getStudentById, students])

    const getStudentSummary = useCallback((studentId, academicYear) => {
        const rows = getInstallmentsForStudent(studentId, academicYear)
        return summarizeStudentFees(rows)
    }, [getInstallmentsForStudent])

    const postAccounting = useCallback((posting) => {
        if (posting.glLines?.length) {
            setGlEntries((prev) => [...posting.glLines, ...prev])
        }
        if (posting.dayBookEntry) {
            setDayBookEntries((prev) => [posting.dayBookEntry, ...prev])
        }
        if (posting.cashBookEntry) {
            setCashBookEntries((prev) => [posting.cashBookEntry, ...prev])
        }
        if (posting.bankBookEntry) {
            setBankBookEntries((prev) => [posting.bankBookEntry, ...prev])
        }
        if (posting.onlineBookEntry) {
            setOnlineBookEntries((prev) => [posting.onlineBookEntry, ...prev])
        }
    }, [])

    const collectFeePayment = useCallback(async (payload) => {
        if (submittingRef.current) {
            return { success: false, errors: ['A payment is already being processed.'] }
        }

        const {
            studentId,
            allocations,
            paymentMode,
            details = {},
            collectedBy = ACTOR_FINANCE_HEAD,
            paymentDate,
            narration,
        } = payload

        const student = getStudentById(studentId)
        if (!student) return { success: false, errors: ['Student not found.'] }

        const selected = (allocations || []).filter((item) => Number(item.amount) > 0)
        if (!selected.length) return { success: false, errors: ['Select at least one payable instalment.'] }

        const totalAmount = selected.reduce((sum, item) => sum + Number(item.amount), 0)
        const liveRows = getInstallmentsForStudent(studentId, student.academicYear)
        const selectedBalance = selected.reduce((sum, item) => {
            const row = liveRows.find((entry) => entry.id === item.installmentId)
            return sum + (row?.balanceAmount || 0)
        }, 0)

        const errors = validatePaymentInput({
            amount: totalAmount,
            balanceAmount: selectedBalance,
            mode: paymentMode,
            details,
        })
        if (errors.length) return { success: false, errors }

        if (isLiveApiEnabled()) {
            submittingRef.current = true
            try {
                const res = await collectPaymentApi({
                    studentId,
                    paymentMode,
                    allocations: selected.map((item) => ({
                        installmentId: item.installmentId,
                        amount: Number(item.amount),
                    })),
                    details,
                    collectedBy,
                    paymentDate: paymentDate || details.transactionDate || details.paymentDate,
                    narration: narration || details.narration,
                })
                if (!res.success) {
                    return {
                        success: false,
                        errors: [typeof res.error === 'string' ? res.error : 'Server rejected the fee collection.'],
                    }
                }
                await rehydrateFromApi()
                return {
                    success: true,
                    receipt: res.data?.receipt || null,
                    transaction: res.data?.transaction || null,
                    paymentReference: res.data?.paymentReference || res.data?.receipt?.transactionReference,
                    held: Boolean(res.data?.held),
                    dataSource: 'backend',
                }
            } finally {
                submittingRef.current = false
            }
        }

        submittingRef.current = true

        try {
            seq.current.pay += 1
            seq.current.txn += 1
            seq.current.voucher += 1
            seq.current.rec += 1

            const payRef = details.paymentReference || generatePaymentReference(seq.current.pay)
            const txnNo = generateTransactionNo(seq.current.txn)
            const voucherNo = generateVoucherNo(seq.current.voucher)
            const receiptNo = generateReceiptNo(seq.current.rec)
            const txnId = `FT-${Date.now()}`
            const isoDate = toIsoDate(paymentDate || details.transactionDate || new Date())
            const bankAccount = bankAccounts.find((item) => item.id === (details.bankAccountId || DEFAULT_BANK_ACCOUNT_ID))
            const chequePostDated = paymentMode === PAYMENT_MODES.CHEQUE && isChequePostDated(details.chequeDate, isoDate)
            const holdsFunds = paymentMode === PAYMENT_MODES.CHEQUE
            const status = holdsFunds
                ? TRANSACTION_STATUSES.PENDING_CLEARANCE
                : TRANSACTION_STATUSES.POSTED

            const feeHeads = selected.map((item) => {
                const row = liveRows.find((entry) => entry.id === item.installmentId)
                return row?.feeHead
            }).filter(Boolean)

            const chequeDetails = paymentMode === PAYMENT_MODES.CHEQUE ? {
                chequeNo: details.chequeNo,
                chequeDate: details.chequeDate,
                bank: details.bank,
                branch: details.branch || '',
                receivedDate: details.receivedDate || isoDate,
                status: chequePostDated ? CHEQUE_STATUSES.PDC : CHEQUE_STATUSES.RECEIVED,
            } : undefined

            const transaction = {
                ...createFinanceTransaction({
                    id: txnId,
                    transactionNo: txnNo,
                    transactionDate: isoDate,
                    paymentMode,
                    amount: totalAmount,
                    student,
                    category: feeHeads[0] || 'Student Fees',
                    reference: details.transactionReference || payRef,
                    narration: narration || details.narration || `Fee collection — ${student.name}`,
                    status,
                    createdBy: collectedBy,
                    voucherNo,
                    chequeDetails,
                    bankAccount,
                }),
                receiptNo,
                installmentIds: selected.map((item) => item.installmentId),
                allocations: selected,
                paymentReference: payRef,
            }

            const receipt = {
                id: `RCP-${txnId}`,
                receiptNo,
                studentId,
                academicYear: student.academicYear,
                className: `${student.className}-${student.section}`,
                admissionNo: student.admissionNo,
                paymentDate: isoDate,
                feeHeads,
                grossFee: selected.reduce((sum, item) => {
                    const row = liveRows.find((entry) => entry.id === item.installmentId)
                    return sum + (row?.feeAmount || 0)
                }, 0),
                concession: selected.reduce((sum, item) => {
                    const row = liveRows.find((entry) => entry.id === item.installmentId)
                    return sum + (row?.concessionAmount || 0)
                }, 0),
                fine: selected.reduce((sum, item) => {
                    const row = liveRows.find((entry) => entry.id === item.installmentId)
                    return sum + (row?.fineAmount || 0)
                }, 0),
                amountPaid: totalAmount,
                paymentMode,
                transactionReference: transaction.reference,
                balance: selectedBalance - totalAmount,
                collectedBy,
                installmentIds: selected.map((item) => item.installmentId),
                reprintCount: 0,
                lastReprintedAt: null,
                lastReprintedBy: null,
                reprintReason: null,
                status: holdsFunds ? 'Pending clearance' : 'Issued',
                communication: { email: false, whatsapp: false },
                transactionId: txnId,
            }

            if (!holdsFunds) {
                setInstallments((prev) => {
                    const stamped = prev.map((row) => {
                        const live = liveRows.find((item) => item.id === row.id)
                        if (!live || !selected.some((item) => item.installmentId === row.id)) return row
                        return { ...row, fineAmount: live.fineAmount, netAmount: live.netAmount }
                    })
                    return applyPaymentToInstallments(stamped, selected)
                })
                const posting = createAccountingPosting({
                    transaction,
                    student,
                    amount: totalAmount,
                    narration: transaction.narration,
                })
                postAccounting(posting)
            } else {
                setCheques((prev) => [{
                    id: `CHQ-${txnId}`,
                    transactionId: txnId,
                    studentId,
                    chequeNo: chequeDetails.chequeNo,
                    bank: chequeDetails.bank,
                    branch: chequeDetails.branch,
                    chequeDate: chequeDetails.chequeDate,
                    receivedDate: chequeDetails.receivedDate,
                    amount: totalAmount,
                    status: chequeDetails.status,
                    narration: transaction.narration,
                    installmentAllocations: selected,
                }, ...prev])
            }

            setTransactions((prev) => [transaction, ...prev])
            setReceipts((prev) => [receipt, ...prev])
            appendAudit({
                action: holdsFunds ? 'CHEQUE_RECEIVED' : 'FEE_PAYMENT_COLLECTED',
                entity: 'FinanceTransaction',
                entityId: txnId,
                newValue: `${formatCurrency(totalAmount)} via ${paymentMode}`,
                reason: transaction.narration,
            })

            return { success: true, transaction, receipt, paymentReference: payRef, held: holdsFunds }
        } finally {
            submittingRef.current = false
        }
    }, [appendAudit, bankAccounts, getInstallmentsForStudent, getStudentById, postAccounting, rehydrateFromApi])

    const settleCheque = useCallback(async (chequeId, nextStatus, reason = '') => {
        const cheque = cheques.find((item) => item.id === chequeId)
        if (!cheque) return { success: false, message: 'Cheque not found.' }

        if (isLiveApiEnabled()) {
            const res = await settleChequeApi({ chequeId, status: nextStatus, reason })
            if (!res.success) {
                return { success: false, message: typeof res.error === 'string' ? res.error : 'Server rejected cheque settlement.' }
            }
            await rehydrateFromApi()
            return { success: true, dataSource: 'backend' }
        }

        setCheques((prev) => prev.map((item) => (
            item.id === chequeId ? { ...item, status: nextStatus } : item
        )))

        setTransactions((prev) => prev.map((txn) => {
            if (txn.id !== cheque.transactionId) return txn
            return {
                ...txn,
                status: nextStatus === CHEQUE_STATUSES.CLEARED
                    ? TRANSACTION_STATUSES.POSTED
                    : nextStatus === CHEQUE_STATUSES.BOUNCED
                        ? TRANSACTION_STATUSES.REVERSED
                        : TRANSACTION_STATUSES.PENDING_CLEARANCE,
                chequeDetails: { ...txn.chequeDetails, status: nextStatus },
            }
        }))

        if (nextStatus === CHEQUE_STATUSES.CLEARED && cheque.installmentAllocations) {
            const student = getStudentById(cheque.studentId)
            const txn = transactions.find((item) => item.id === cheque.transactionId)
            setInstallments((prev) => applyPaymentToInstallments(prev, cheque.installmentAllocations))
            if (txn) {
                const posted = { ...txn, status: TRANSACTION_STATUSES.POSTED }
                postAccounting(createAccountingPosting({
                    transaction: posted,
                    student,
                    amount: cheque.amount,
                    narration: cheque.narration,
                }))
                setReceipts((prev) => prev.map((receipt) => (
                    receipt.transactionId === txn.id ? { ...receipt, status: 'Issued' } : receipt
                )))
            }
        }

        appendAudit({
            action: nextStatus === CHEQUE_STATUSES.BOUNCED ? 'CHEQUE_BOUNCED' : 'CHEQUE_STATUS_CHANGED',
            entity: 'Cheque',
            entityId: chequeId,
            oldValue: cheque.status,
            newValue: nextStatus,
            reason,
        })

        return { success: true }
    }, [appendAudit, cheques, getStudentById, postAccounting, rehydrateFromApi, transactions])

    const waiveFine = useCallback(({ installmentId, reason, changedBy = ACTOR_FINANCE_HEAD }) => {
        if (!reason?.trim()) return { success: false, message: 'Reason is required to waive a fine.' }
        const current = installments.find((row) => row.id === installmentId)
        if (!current) return { success: false, message: 'Instalment not found.' }

        setInstallments((prev) => prev.map((row) => (
            row.id === installmentId
                ? {
                    ...row,
                    fineWaived: true,
                    fineAmount: 0,
                    fineWaiver: {
                        reason: reason.trim(),
                        changedBy,
                        changedAt: new Date().toISOString(),
                    },
                }
                : row
        )))
        appendAudit({
            action: 'FINE_WAIVED',
            entity: 'FeeInstallment',
            entityId: installmentId,
            oldValue: String(current.fineAmount ?? 0),
            newValue: '0',
            reason,
            performedBy: changedBy,
        })
        return { success: true }
    }, [appendAudit, installments])

    const generatePaymentLink = useCallback(({ studentId, amount, installmentIds }) => {
        seq.current.link += 1
        const reference = generatePaymentReference(seq.current.link)
        const student = getStudentById(studentId)
        const link = {
            id: `LNK-${reference}`,
            reference,
            studentId,
            amount,
            installmentIds,
            url: `${window.location.origin}/student/payment/fees-payment?ref=${reference}`,
            status: 'OPEN',
            createdAt: new Date().toISOString(),
        }
        setPaymentLinks((prev) => [link, ...prev])
        appendAudit({
            action: 'PAYMENT_LINK_GENERATED',
            entity: 'PaymentLink',
            entityId: link.id,
            newValue: reference,
            reason: `Payment link for ${student?.name ?? studentId}`,
        })
        return link
    }, [appendAudit, getStudentById])

    const reprintReceipt = useCallback(({ receiptId, reason, reprintedBy = ACTOR_FINANCE_HEAD }) => {
        const receipt = receipts.find((item) => item.id === receiptId)
        if (!receipt) return { success: false, message: 'Receipt not found.' }
        setReceipts((prev) => prev.map((item) => (
            item.id === receiptId
                ? {
                    ...item,
                    reprintCount: (item.reprintCount || 0) + 1,
                    lastReprintedAt: new Date().toISOString(),
                    lastReprintedBy: reprintedBy,
                    reprintReason: reason || item.reprintReason,
                }
                : item
        )))
        appendAudit({
            action: 'RECEIPT_REPRINTED',
            entity: 'Receipt',
            entityId: receiptId,
            oldValue: String(receipt.reprintCount || 0),
            newValue: String((receipt.reprintCount || 0) + 1),
            reason,
            performedBy: reprintedBy,
        })
        return { success: true, receiptNo: receipt.receiptNo }
    }, [appendAudit, receipts])

    const decideApproval = useCallback(async ({ approvalId, decision, remarks = '' }) => {
        const status = String(decision || '').toLowerCase() === 'approved' ? 'approved' : 'rejected'
        if (status === 'rejected' && !String(remarks || '').trim()) {
            return { success: false, message: 'A rejection rationale is required.' }
        }
        if (isLiveApiEnabled()) {
            const res = await decideFinanceApprovalApi({
                approvalId,
                decision: status,
                remarks: String(remarks || '').trim(),
            })
            if (!res.success) {
                return {
                    success: false,
                    message: typeof res.error === 'string' ? res.error : 'Server rejected the approval decision.',
                }
            }
            await rehydrateFromApi()
            return { success: true, dataSource: 'backend', approval: res.data?.approval || null }
        }

        const nextStatus = status === 'approved' ? 'Approved' : 'Rejected'
        let found = false
        setApprovals((prev) => prev.map((row) => {
            if (row.id !== approvalId) return row
            found = true
            return {
                ...row,
                status: nextStatus,
                decidedAt: new Date().toISOString(),
                decidedBy: ACTOR_FINANCE_HEAD,
                remarks: String(remarks || '').trim(),
                decision: {
                    actor: ACTOR_FINANCE_HEAD,
                    actorRole: 'Account Head',
                    remarks: String(remarks || '').trim(),
                    decidedAt: new Date().toISOString(),
                },
            }
        }))
        if (!found) return { success: false, message: 'Approval not found.' }
        appendAudit({
            action: nextStatus === 'Approved' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
            entity: 'Approval',
            entityId: approvalId,
            newValue: nextStatus,
            reason: String(remarks || '').trim(),
        })
        return { success: true, dataSource: 'local' }
    }, [appendAudit, rehydrateFromApi])

    const sendReceipt = useCallback(async ({ receiptId, channel }) => {
        const receipt = receipts.find((item) => item.id === receiptId)
        if (!receipt) return { success: false, message: 'Receipt not found.' }
        if (isLiveApiEnabled()) {
            const res = await sendReceiptApi({ receiptId, channel })
            if (!res.success) {
                return { success: false, message: typeof res.error === 'string' ? res.error : 'Server rejected receipt send.' }
            }
            await rehydrateFromApi()
            return {
                success: true,
                receiptNo: receipt.receiptNo,
                dataSource: 'backend',
                delivered: Boolean(res.data?.delivered),
                stub: res.data?.queued_stub || res.data?.status,
            }
        }
        setReceipts((prev) => prev.map((item) => (
            item.id === receiptId
                ? {
                    ...item,
                    communication: {
                        ...item.communication,
                        [channel]: true,
                    },
                }
                : item
        )))
        appendAudit({
            action: channel === 'whatsapp' ? 'RECEIPT_SENT_WHATSAPP' : 'RECEIPT_SENT_EMAIL',
            entity: 'Receipt',
            entityId: receiptId,
            newValue: receipt.receiptNo,
            reason: `Mock ${channel} delivery`,
        })
        return { success: true, receiptNo: receipt.receiptNo }
    }, [appendAudit, receipts, rehydrateFromApi])

    const addFeeStructure = useCallback((structure) => {
        const id = structure.id || `FS-${Date.now()}`
        setFeeStructures((prev) => [{ ...structure, id, status: structure.status || 'ACTIVE' }, ...prev])
        appendAudit({
            action: 'FEE_STRUCTURE_CHANGED',
            entity: 'FeeStructure',
            entityId: id,
            newValue: `${structure.feeHead} ${formatCurrency(structure.amount)}`,
            reason: 'Structure defined',
        })
        return id
    }, [appendAudit])

    const addFeeCategory = useCallback((name) => {
        const id = `CAT-${name.toUpperCase().replace(/\s+/g, '-')}`
        setFeeCategories((prev) => {
            if (prev.some((item) => item.id === id)) return prev
            return [...prev, { id, name, code: id.replace('CAT-', ''), active: true }]
        })
        return id
    }, [])

    const addManualEntry = useCallback((entry) => {
        seq.current.txn += 1
        seq.current.voucher += 1
        const transaction = createFinanceTransaction({
            id: `MAN-${Date.now()}`,
            transactionNo: generateTransactionNo(seq.current.txn),
            transactionDate: entry.date,
            paymentMode: entry.paymentMode || PAYMENT_MODES.CASH,
            amount: Number(entry.amount),
            student: null,
            category: entry.category || 'Manual',
            reference: entry.reference || generateVoucherNo(seq.current.voucher),
            narration: entry.narration,
            status: entry.status || TRANSACTION_STATUSES.DRAFT,
            createdBy: entry.createdBy || ACTOR_FINANCE_HEAD,
            voucherNo: generateVoucherNo(seq.current.voucher),
            bankAccount: bankAccounts.find((item) => item.id === entry.bankAccountId),
            sourceModule: SOURCE_MODULES.MANUAL,
        })
        transaction.direction = entry.direction || TRANSACTION_DIRECTIONS.IN
        transaction.entryType = entry.entryType
        setTransactions((prev) => [transaction, ...prev])
        appendAudit({
            action: 'MANUAL_ENTRY_CREATED',
            entity: 'FinanceTransaction',
            entityId: transaction.id,
            newValue: transaction.status,
            reason: entry.narration,
        })
        return transaction
    }, [appendAudit, bankAccounts])

    const postManualEntry = useCallback((transactionId) => {
        const transaction = transactions.find((item) => item.id === transactionId)
        if (!transaction) return { success: false, message: 'Entry not found.' }
        if (transaction.status === TRANSACTION_STATUSES.POSTED) {
            return { success: false, message: 'Posted entries cannot be silently edited. Use reversal.' }
        }
        const posted = { ...transaction, status: TRANSACTION_STATUSES.POSTED }
        setTransactions((prev) => prev.map((item) => (item.id === transactionId ? posted : item)))
        postAccounting(createAccountingPosting({
            transaction: posted,
            student: getStudentById(transaction.studentId),
            amount: transaction.amount,
            narration: transaction.narration,
        }))
        appendAudit({
            action: 'MANUAL_ENTRY_POSTED',
            entity: 'FinanceTransaction',
            entityId: transactionId,
            oldValue: transaction.status,
            newValue: TRANSACTION_STATUSES.POSTED,
            reason: transaction.narration,
        })
        return { success: true }
    }, [appendAudit, getStudentById, postAccounting, transactions])

    const editNarration = useCallback(({ transactionId, narration, reason, changedBy = ACTOR_FINANCE_HEAD }) => {
        const transaction = transactions.find((item) => item.id === transactionId)
        if (!transaction) return { success: false, message: 'Transaction not found.' }
        if (transaction.status === TRANSACTION_STATUSES.POSTED && !reason?.trim()) {
            return { success: false, message: 'Reason is required to edit narration after posting.' }
        }

        setTransactions((prev) => prev.map((item) => (
            item.id === transactionId ? { ...item, narration } : item
        )))
        const applyNarration = (item) => (
            item.sourceTransactionId === transactionId
                ? { ...item, description: narration, narration }
                : item
        )
        setDayBookEntries((prev) => prev.map(applyNarration))
        setCashBookEntries((prev) => prev.map(applyNarration))
        setBankBookEntries((prev) => prev.map(applyNarration))
        setOnlineBookEntries((prev) => prev.map((item) => (
            item.sourceTransactionId === transactionId
                ? { ...item, detail: { ...item.detail, remarks: narration } }
                : item
        )))
        setGlEntries((prev) => prev.map((item) => (
            item.sourceTransactionId === transactionId
                ? { ...item, description: narration }
                : item
        )))
        appendAudit({
            action: 'NARRATION_EDITED',
            entity: 'FinanceTransaction',
            entityId: transactionId,
            oldValue: transaction.narration,
            newValue: narration,
            reason,
            performedBy: changedBy,
            field: 'narration',
        })
        return { success: true }
    }, [appendAudit, transactions])

    const reverseTransaction = useCallback(({ transactionId, reason }) => {
        if (!reason?.trim()) return { success: false, message: 'Reason is required for reversals.' }
        const transaction = transactions.find((item) => item.id === transactionId)
        if (!transaction) return { success: false, message: 'Transaction not found.' }

        setTransactions((prev) => prev.map((item) => (
            item.id === transactionId ? { ...item, status: TRANSACTION_STATUSES.REVERSED } : item
        )))
        appendAudit({
            action: 'PAYMENT_REVERSED',
            entity: 'FinanceTransaction',
            entityId: transactionId,
            oldValue: transaction.status,
            newValue: TRANSACTION_STATUSES.REVERSED,
            reason,
        })
        return { success: true }
    }, [appendAudit, transactions])

    const postExternalInflow = useCallback(({ amount, category, paymentMode, reference, narration, sourceModule }) => {
        seq.current.txn += 1
        seq.current.voucher += 1
        const transaction = createFinanceTransaction({
            id: `EXT-${Date.now()}`,
            transactionNo: generateTransactionNo(seq.current.txn),
            transactionDate: new Date(),
            paymentMode: paymentMode || PAYMENT_MODES.CASH,
            amount,
            student: null,
            category,
            reference,
            narration,
            status: TRANSACTION_STATUSES.POSTED,
            createdBy: ACTOR_FINANCE_HEAD,
            voucherNo: generateVoucherNo(seq.current.voucher),
            bankAccount: bankAccounts[0],
            sourceModule: sourceModule || SOURCE_MODULES.OTHER,
        })
        setTransactions((prev) => [transaction, ...prev])
        postAccounting(createAccountingPosting({
            transaction,
            student: null,
            amount,
            narration,
        }))
        return transaction
    }, [bankAccounts, postAccounting])

    const resetFinanceDemoData = useCallback(async () => {
        if (isLiveApiEnabled()) {
            setLiveLoading(true)
            const reset = await resetFinanceStateApi()
            if (!reset.success) {
                setLiveLoading(false)
                setLiveError(typeof reset.error === 'string' ? reset.error : 'Finance reset failed on the server.')
                return { success: false, error: reset.error }
            }
            const seed = createSeedFinanceState()
            // Keep campus students already present on the empty snapshot when available.
            const remoteStudents = Array.isArray(reset.data?.data?.students) ? reset.data.data.students : []
            const studentsForSeed = remoteStudents.length ? remoteStudents : FINANCE_STUDENTS
            const payload = snapshotFromContext({
                students: studentsForSeed,
                feeCategories: seed.feeCategories,
                feeStructures: seed.feeStructures,
                fineRules: seed.fineRules,
                bankAccounts: seed.bankAccounts,
                posTerminals: seed.posTerminals,
                concessions: seed.concessions,
                installments: seed.installments,
                annualBudget: BUDGET_SEED,
                transactions: seed.transactions,
                receipts: seed.receipts,
                cheques: seed.cheques,
                paymentLinks: seed.paymentLinks,
                auditLog: seed.auditLog,
                glEntries: seed.glEntries,
                dayBookEntries: seed.dayBookEntries,
                cashBookEntries: seed.cashBookEntries,
                bankBookEntries: seed.bankBookEntries,
                onlineBookEntries: seed.onlineBookEntries,
                reconciliationItems: seed.reconciliationItems,
                sequence: { ...seed.sequence },
                meta: { seeded: true },
            })
            // Seed masters into the empty campus ledger so Fees/Collections can be exercised.
            const saved = await saveFinanceStateApi(payload)
            if (!saved.success) {
                setLiveLoading(false)
                setLiveError(typeof saved.error === 'string' ? saved.error : 'Could not seed finance state on the server.')
                return { success: false, error: saved.error }
            }
            applyRemoteState(saved.data)
            setLiveError('')
            setLiveSource('backend')
            setLiveLoading(false)
            return { success: true, dataSource: 'backend' }
        }

        skipPersistRef.current = true
        clearFinanceState()
        const seed = createSeedFinanceState()
        seq.current = { ...seed.sequence }
        setStudents(FINANCE_STUDENTS)
        setFeeCategories(seed.feeCategories)
        setFeeStructures(seed.feeStructures)
        setFineRules(seed.fineRules)
        setBankAccounts(seed.bankAccounts)
        setPosTerminals(seed.posTerminals)
        setConcessions(seed.concessions)
        setInstallments(seed.installments)
        setTransactions(seed.transactions)
        setReceipts(seed.receipts)
        setCheques(seed.cheques)
        setPaymentLinks(seed.paymentLinks)
        setAuditLog(seed.auditLog)
        setGlEntries(seed.glEntries)
        setDayBookEntries(seed.dayBookEntries)
        setCashBookEntries(seed.cashBookEntries)
        setBankBookEntries(seed.bankBookEntries)
        setOnlineBookEntries(seed.onlineBookEntries)
        setReconciliationItems(seed.reconciliationItems)
        setLastSavedAt(null)
        return { success: true, dataSource: 'local' }
    }, [applyRemoteState])

    const moneyInTransactions = useMemo(
        () => transactions.filter((item) => item.direction === TRANSACTION_DIRECTIONS.IN),
        [transactions],
    )

    const postedInflow = useMemo(
        () => transactions.filter((item) => (
            item.direction === TRANSACTION_DIRECTIONS.IN
            && item.status === TRANSACTION_STATUSES.POSTED
        )),
        [transactions],
    )

    const dashboardMetrics = useMemo(() => {
        const today = toIsoDate(new Date())
        const todaysCollection = postedInflow
            .filter((item) => item.transactionDate === today && item.sourceModule === SOURCE_MODULES.FEES)
            .reduce((sum, item) => sum + item.amount, 0)
        const currentDue = hydratedInstallments
            .filter((row) => row.status === 'UNPAID' || row.status === 'PARTIALLY_PAID')
            .reduce((sum, row) => sum + row.balanceAmount, 0)
        const overdue = hydratedInstallments
            .filter((row) => row.status === 'OVERDUE')
            .reduce((sum, row) => sum + row.balanceAmount, 0)
        const chequePending = cheques
            .filter((item) => item.status !== CHEQUE_STATUSES.CLEARED && item.status !== CHEQUE_STATUSES.BOUNCED && item.status !== CHEQUE_STATUSES.CANCELLED)
            .reduce((sum, item) => sum + item.amount, 0)
        const netDemand = hydratedInstallments.reduce((sum, row) => sum + row.netAmount, 0)
        const collected = hydratedInstallments.reduce((sum, row) => sum + row.paidAmount, 0)
        const efficiency = netDemand > 0 ? (collected / netDemand) * 100 : 0

        return {
            todaysCollection,
            currentDue,
            overdue,
            chequePending,
            collectionEfficiency: efficiency,
            collected,
            netDemand,
        }
    }, [cheques, hydratedInstallments, postedInflow])

    useEffect(() => {
        if (skipPersistRef.current) {
            skipPersistRef.current = false
            return
        }

        if (isLiveApiEnabled()) {
            if (!liveReadyRef.current || liveLoading || !getAccessToken()) return undefined
            if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
            persistTimerRef.current = setTimeout(async () => {
                if (!getAccessToken()) return
                const snapshot = snapshotFromContext({
                    students,
                    feeCategories,
                    feeStructures,
                    fineRules,
                    bankAccounts,
                    posTerminals,
                    concessions,
                    installments,
                    annualBudget,
                    transactions,
                    receipts,
                    cheques,
                    paymentLinks,
                    auditLog,
                    glEntries,
                    dayBookEntries,
                    cashBookEntries,
                    bankBookEntries,
                    onlineBookEntries,
                    reconciliationItems,
                    sequence: { ...seq.current },
                    meta: { seeded: true },
                })
                // Preserve live-only collections already on the snapshot so PUT does not wipe them.
                snapshot.approvals = approvals
                snapshot.wallets = wallets
                snapshot.walletRecharges = walletRecharges
                snapshot.transportFleet = transportFleet
                const res = await saveFinanceStateApi(snapshot)
                if (res.success) {
                    setLastSavedAt(res.data?.savedAt || new Date().toISOString())
                    setLiveError('')
                    setLiveSource('backend')
                } else {
                    setLiveError(typeof res.error === 'string' ? res.error : 'Failed to persist finance state.')
                    setLiveSource('error')
                }
            }, 500)
            return () => {
                if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
            }
        }

        const payload = saveFinanceState({
            feeCategories,
            feeStructures,
            fineRules,
            bankAccounts,
            posTerminals,
            concessions,
            installments,
            annualBudget,
            transactions,
            receipts,
            cheques,
            paymentLinks,
            auditLog,
            glEntries,
            dayBookEntries,
            cashBookEntries,
            bankBookEntries,
            onlineBookEntries,
            reconciliationItems,
            sequence: { ...seq.current },
        })
        if (payload?.savedAt) setLastSavedAt(payload.savedAt)
        return undefined
    }, [
        annualBudget,
        approvals,
        auditLog,
        bankAccounts,
        bankBookEntries,
        cashBookEntries,
        cheques,
        concessions,
        dayBookEntries,
        feeCategories,
        feeStructures,
        fineRules,
        glEntries,
        installments,
        liveLoading,
        onlineBookEntries,
        paymentLinks,
        posTerminals,
        receipts,
        reconciliationItems,
        students,
        transactions,
        transportFleet,
        walletRecharges,
        wallets,
    ])

    const issueActivityFeeReceipt = useCallback((payload) => {
        const student = payload.studentId ? getStudentById(payload.studentId) : null
        const txnId = `ACT-${Date.now()}`
        const receiptNo = generateReceiptNo(seq.current.rec)
        seq.current.rec += 1
        const receipt = {
            id: `RCP-${txnId}`,
            receiptNo,
            studentId: student?.id || payload.participantName || 'Outsider',
            academicYear: payload.academicYear || student?.academicYear || '',
            className: student ? `${student.className}-${student.section}` : 'Activity',
            admissionNo: student?.admissionNo || payload.participantName || '',
            paymentDate: toIsoDate(new Date()),
            feeHeads: [payload.activityName],
            grossFee: Number(payload.gross) || 0,
            concession: Number(payload.concession) || 0,
            fine: 0,
            amountPaid: Number(payload.payable) || 0,
            paymentMode: 'Cash',
            transactionReference: txnId,
            balance: 0,
            collectedBy: ACTOR_FINANCE_HEAD,
            installmentIds: [],
            reprintCount: 0,
            lastReprintedAt: null,
            lastReprintedBy: null,
            reprintReason: null,
            status: 'Issued',
            communication: { email: false, whatsapp: false },
            transactionId: txnId,
            source: 'Activity Fee',
        }
        setReceipts((prev) => [receipt, ...prev])
        appendAudit({
            action: 'ACTIVITY_FEE_COLLECTED',
            entity: 'Receipt',
            entityId: receipt.id,
            newValue: receiptNo,
            reason: payload.activityName,
        })
        return { success: true, receipt }
    }, [appendAudit, getStudentById])

    const value = useMemo(() => ({
        students,
        feeCategories,
        feeStructures,
        fineRules,
        bankAccounts,
        posTerminals,
        concessions,
        installments: hydratedInstallments,
        rawInstallments: installments,
        annualBudget,
        updateAnnualBudget: (id, field, value) => {
            setAnnualBudget((prev) => prev.map((row) => (
                row.id === id ? { ...row, [field]: Number(value) || 0 } : row
            )))
        },
        recordVoucherAction: (transactionId, action) => {
            setTransactions((prev) => prev.map((item) => (
                item.id === transactionId
                    ? {
                        ...item,
                        voucherStatus: 'Issued',
                        preparedBy: item.preparedBy || item.createdBy || 'Finance Head',
                        voucherAction: action,
                        voucherActionAt: new Date().toISOString(),
                    }
                    : item
            )))
        },
        transactions,
        receipts,
        cheques,
        paymentLinks,
        auditLog,
        glEntries,
        dayBookEntries,
        cashBookEntries,
        bankBookEntries,
        onlineBookEntries,
        reconciliationItems,
        moneyInTransactions,
        postedInflow,
        dashboardMetrics,
        getStudentById,
        getInstallmentsForStudent,
        getSiblings,
        getStudentSummary,
        calculateStudentOutstanding: (studentId, academicYear) => (
            calculateStudentOutstanding(getInstallmentsForStudent(studentId, academicYear))
        ),
        collectFeePayment,
        issueActivityFeeReceipt,
        settleCheque,
        waiveFine,
        decideApproval,
        generatePaymentLink,
        reprintReceipt,
        sendReceipt,
        addFeeStructure,
        addFeeCategory,
        setFeeStructures,
        setFineRules,
        setBankAccounts,
        setPosTerminals,
        setConcessions,
        addManualEntry,
        postManualEntry,
        editNarration,
        reverseTransaction,
        postExternalInflow,
        setReconciliationItems,
        resetFinanceDemoData,
        rehydrateFromApi,
        lastSavedAt,
        liveLoading,
        liveError,
        liveSource,
        approvals,
        wallets,
        walletRecharges,
        transportFleet,
        financePersistence: {
            enabled: true,
            storageKey: FINANCE_STORAGE_KEY,
            lastSavedAt,
            live: isLiveApiEnabled(),
            liveSource,
            liveError,
            liveLoading,
        },
        cloneSeed: () => clone(FEE_INSTALLMENTS),
    }), [
        annualBudget,
        addFeeCategory,
        addFeeStructure,
        addManualEntry,
        auditLog,
        bankAccounts,
        bankBookEntries,
        cashBookEntries,
        cheques,
        collectFeePayment,
        issueActivityFeeReceipt,
        concessions,
        dashboardMetrics,
        dayBookEntries,
        decideApproval,
        editNarration,
        feeCategories,
        feeStructures,
        fineRules,
        generatePaymentLink,
        getInstallmentsForStudent,
        getSiblings,
        getStudentById,
        getStudentSummary,
        glEntries,
        hydratedInstallments,
        installments,
        moneyInTransactions,
        onlineBookEntries,
        paymentLinks,
        posTerminals,
        postExternalInflow,
        postManualEntry,
        postedInflow,
        receipts,
        reconciliationItems,
        reprintReceipt,
        reverseTransaction,
        sendReceipt,
        settleCheque,
        students,
        transactions,
        waiveFine,
        resetFinanceDemoData,
        rehydrateFromApi,
        lastSavedAt,
        liveLoading,
        liveError,
        liveSource,
        approvals,
        wallets,
        walletRecharges,
        transportFleet,
    ])

    return (
        <FinanceContext.Provider value={value}>
            {children}
        </FinanceContext.Provider>
    )
}

// Hook lives with the provider so consumers share one context instance.
// eslint-disable-next-line react-refresh/only-export-components -- domain hook is the public API
export const useFinance = () => {
    const context = useContext(FinanceContext)
    if (!context) {
        throw new Error('useFinance must be used within FinanceProvider')
    }
    return context
}
