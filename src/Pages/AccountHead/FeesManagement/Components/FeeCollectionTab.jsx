import React, { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, History, Link2, RefreshCw, User, Users, Wallet } from 'lucide-react'
import { toast } from 'react-toastify'
import { DEFAULT_ACADEMIC_YEAR, FEE_INSTALLMENT_STATUSES, paymentModeLabel } from '../../financeDomain/financeConstants'
import { formatCurrency, formatDisplayDate, groupInstallmentsByMonth } from '../../financeDomain/financeHelpers'
import { useFinance } from '../../financeDomain/FinanceContext'
import { DataTable, StatusBadge } from '../../../../Common/ui'
import StudentSearch from './StudentSearch'
import StudentFeeProfile from './StudentFeeProfile'
import StudentFeeSummary from './StudentFeeSummary'
import FeeInstallmentCard from './FeeInstallmentCard'
import FeePaymentModal from './FeePaymentModal'
import SiblingFeesDrawer from './SiblingFeesDrawer'
import PaymentHistoryDrawer from './PaymentHistoryDrawer'
import ReceiptDetailsDrawer from './ReceiptDetailsDrawer'
import EntryClosureGate from '../../../../Common/demoDomain/EntryClosureGate'
import { entryBlocked } from '../../../../Common/demoDomain/governance'
import { openPrintDocument } from '../../../../Common/printDocument'

const escapeHtml = (value) => String(value ?? '—')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const FeeCollectionTab = () => {
    const {
        students,
        getStudentById,
        getInstallmentsForStudent,
        getSiblings,
        getStudentSummary,
        collectFeePayment,
        receipts,
        reprintReceipt,
        bankAccounts,
        posTerminals,
        waiveFine,
    } = useFinance()

    const [academicYear, setAcademicYear] = useState(DEFAULT_ACADEMIC_YEAR)
    const [student, setStudent] = useState(null)
    const [selectedIds, setSelectedIds] = useState([])
    const [partials, setPartials] = useState({})
    const [paymentOpen, setPaymentOpen] = useState(false)
    const [siblingsOpen, setSiblingsOpen] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [receipt, setReceipt] = useState(null)
    const [siblingSelection, setSiblingSelection] = useState([])
    const [activeStudentId, setActiveStudentId] = useState(null)
    const [waiverReason, setWaiverReason] = useState('')
    const [consoleView, setConsoleView] = useState('student') // 'student' | 'parent'

    const activeStudent = student || getStudentById(activeStudentId)
    const installments = activeStudent
        ? getInstallmentsForStudent(activeStudent.id, academicYear)
        : []
    const summary = activeStudent ? getStudentSummary(activeStudent.id, academicYear) : null
    const siblings = activeStudent ? getSiblings(activeStudent.id) : []
    const grouped = groupInstallmentsByMonth(installments)

    const siblingSummaries = {}
    siblings.forEach((item) => {
        siblingSummaries[item.id] = getStudentSummary(item.id, academicYear)
    })

    const allocations = selectedIds.map((id) => {
        const row = installments.find((item) => item.id === id)
        if (!row) return null
        const amount = Number(partials[id] ?? row.balanceAmount)
        return { installmentId: id, amount }
    }).filter(Boolean)

    const totalAmount = allocations.reduce((sum, item) => sum + item.amount, 0)
    const lateFee = selectedIds.reduce((sum, id) => {
        const row = installments.find((item) => item.id === id)
        return sum + (row?.fineAmount || 0)
    }, 0)

    const studentReceipts = receipts.filter((item) => item.studentId === activeStudent?.id)

    const selectStudent = (next) => {
        setStudent(next)
        setActiveStudentId(next?.id ?? null)
        setSelectedIds([])
        setPartials({})
    }

    const toggleInstallment = (row) => {
        if (!row.payable) return
        setSelectedIds((prev) => (
            prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id]
        ))
        setPartials((prev) => ({ ...prev, [row.id]: row.balanceAmount }))
    }

    const confirmPayment = async (payload) => {
        if (entryBlocked('Finance', 'Account Head')) return { success: false }
        return collectFeePayment({
            studentId: activeStudent.id,
            allocations,
            ...payload,
            collectedBy: payload.details?.receivedBy || 'Finance Head',
        })
    }

    const handleCollectResult = async (payload) => {
        const result = await confirmPayment(payload)
        if (result?.success) {
            setSelectedIds([])
            setPartials({})
            if (result.receipt) setReceipt(result.receipt)
        }
        return result
    }

    const handleWaive = (installmentId) => {
        if (entryBlocked('Finance', 'Account Head')) return
        const result = waiveFine({ installmentId, reason: waiverReason })
        if (!result.success) toast.error(result.message)
        else {
            toast.success('Fine waived.')
            setWaiverReason('')
        }
    }

    const printReceipt = (selectedReceipt) => {
        const fields = [
            ['Receipt', selectedReceipt.receiptNo],
            ['Student', activeStudent?.name || selectedReceipt.admissionNo],
            ['Admission no.', activeStudent?.admissionNo || selectedReceipt.admissionNo],
            ['Payment date', formatDisplayDate(selectedReceipt.paymentDate)],
            ['Fee heads', (selectedReceipt.feeHeads || []).join(', ')],
            ['Amount paid', formatCurrency(selectedReceipt.amountPaid)],
            ['Payment mode', paymentModeLabel(selectedReceipt.paymentMode)],
            ['Transaction reference', selectedReceipt.transactionReference],
            ['Collected by', selectedReceipt.collectedBy],
        ]
        openPrintDocument({
            title: `Receipt ${selectedReceipt.receiptNo}`,
            body: `<h1 style="margin-bottom:16px">Fee receipt</h1><table><tbody>${fields.map(([label, value]) => `<tr><th style="text-align:left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody></table><p style="margin-top:16px;font-size:11px;color:#667085">Browser-stored demonstration receipt. Verify against the production ledger before external use.</p>`,
        })
    }

    // Upfront Student-wise payment records
    const studentRows = useMemo(() => {
        return (students || []).map((s) => {
            const insts = getInstallmentsForStudent(s.id, academicYear)
            const smm = getStudentSummary(s.id, academicYear)
            const totalBilled = smm?.totalFee || smm?.netPayable || 0
            const totalPaid = smm?.paid || 0
            const balanceAmount = smm?.outstanding ?? Math.max(0, totalBilled - totalPaid)

            let feeStatus = 'Pending'
            if (balanceAmount === 0 && totalPaid > 0) {
                feeStatus = 'Paid'
            } else if (totalPaid > 0 && balanceAmount > 0) {
                feeStatus = 'Partially Paid'
            } else {
                const hasOverdue = insts.some((i) => i.status === 'OVERDUE' || (i.dueDate && new Date(i.dueDate) < new Date() && i.balanceAmount > 0))
                if (hasOverdue) feeStatus = 'Overdue'
                else if (totalBilled === 0) feeStatus = 'Paid'
                else feeStatus = 'Pending'
            }

            const studentPayments = (receipts || []).filter((r) => r.studentId === s.id)

            return {
                id: s.id,
                admissionNumber: s.admissionNo,
                studentName: s.name,
                gradeSection: `${s.className}-${s.section}`,
                fatherName: s.fatherName,
                motherName: s.motherName,
                phone: s.phone,
                familyId: s.familyId || `FAM-${s.id}`,
                feeStatus,
                totalBilled,
                totalPaid,
                balanceAmount,
                paymentHistory: studentPayments,
                rawStudent: s,
            }
        })
    }, [students, academicYear, getInstallmentsForStudent, getStudentSummary, receipts])

    // Upfront Parent-wise grouped records
    const parentRows = useMemo(() => {
        const familyMap = new Map()
        studentRows.forEach((st) => {
            const famKey = st.familyId || st.phone || st.fatherName || st.id
            if (!familyMap.has(famKey)) {
                familyMap.set(famKey, {
                    id: famKey,
                    familyId: st.familyId || famKey,
                    parentName: st.fatherName || st.motherName || 'Parent',
                    phone: st.phone || '—',
                    children: [],
                    totalBilled: 0,
                    totalPaid: 0,
                    totalBalance: 0,
                })
            }
            const fam = familyMap.get(famKey)
            fam.children.push(st)
            fam.totalBilled += st.totalBilled
            fam.totalPaid += st.totalPaid
            fam.totalBalance += st.balanceAmount
        })

        return Array.from(familyMap.values()).map((fam) => {
            let aggregateStatus = 'Pending'
            const statuses = fam.children.map((c) => c.feeStatus)
            if (statuses.every((s) => s === 'Paid')) {
                aggregateStatus = 'Paid'
            } else if (statuses.some((s) => s === 'Overdue')) {
                aggregateStatus = 'Overdue'
            } else if (statuses.some((s) => s === 'Partially Paid') || fam.totalPaid > 0) {
                aggregateStatus = 'Partially Paid'
            } else {
                aggregateStatus = 'Pending'
            }
            return {
                ...fam,
                aggregateStatus,
            }
        })
    }, [studentRows])

    const studentColumns = [
        {
            key: 'student',
            label: 'Student',
            required: true,
            render: (row) => (
                <div>
                    <span className='font-semibold text-[var(--erp-ink)] block'>{row.studentName}</span>
                    <span className='text-xs text-[var(--erp-muted)] font-mono'>{row.admissionNumber}</span>
                </div>
            ),
        },
        { key: 'gradeSection', label: 'Class & Section' },
        {
            key: 'parent',
            label: 'Parent & Contact',
            render: (row) => (
                <div>
                    <span className='text-sm text-[var(--erp-ink)] block'>{row.fatherName || row.motherName || 'Parent'}</span>
                    <span className='text-xs text-[var(--erp-muted)]'>{row.phone}</span>
                </div>
            ),
        },
        {
            key: 'totalBilled',
            label: 'Total Billed',
            render: (row) => <span className='font-semibold text-[var(--erp-ink)]'>{formatCurrency(row.totalBilled)}</span>,
        },
        {
            key: 'totalPaid',
            label: 'Total Paid',
            render: (row) => <span className='text-emerald-700 font-semibold'>{formatCurrency(row.totalPaid)}</span>,
        },
        {
            key: 'balanceAmount',
            label: 'Balance Amount',
            render: (row) => <span className={row.balanceAmount > 0 ? 'font-bold text-rose-600' : 'text-slate-500'}>{formatCurrency(row.balanceAmount)}</span>,
        },
        {
            key: 'feeStatus',
            label: 'Payment Status',
            render: (row) => <StatusBadge status={row.feeStatus} />,
        },
    ]

    const parentColumns = [
        {
            key: 'parentName',
            label: 'Parent Name & Family ID',
            required: true,
            render: (row) => (
                <div>
                    <span className='font-semibold text-[var(--erp-ink)] block'>{row.parentName}</span>
                    <span className='text-xs text-[var(--erp-muted)] font-mono'>{row.familyId}</span>
                </div>
            ),
        },
        { key: 'phone', label: 'Contact Phone' },
        {
            key: 'children',
            label: 'Linked Wards',
            render: (row) => (
                <div className='flex flex-wrap gap-1.5'>
                    {row.children.map((c) => (
                        <span key={c.id} className='inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--erp-canvas)] text-xs font-medium text-[var(--erp-slate)] border border-[var(--erp-line)]'>
                            <span>{c.studentName}</span>
                            <span className='text-[10px] text-[var(--erp-muted)]'>({c.gradeSection})</span>
                        </span>
                    ))}
                </div>
            ),
        },
        {
            key: 'totalBilled',
            label: 'Total Billed',
            render: (row) => <span className='font-semibold text-[var(--erp-ink)]'>{formatCurrency(row.totalBilled)}</span>,
        },
        {
            key: 'totalPaid',
            label: 'Total Paid',
            render: (row) => <span className='text-emerald-700 font-semibold'>{formatCurrency(row.totalPaid)}</span>,
        },
        {
            key: 'totalBalance',
            label: 'Total Balance',
            render: (row) => <span className={row.totalBalance > 0 ? 'font-bold text-rose-600' : 'text-slate-500'}>{formatCurrency(row.totalBalance)}</span>,
        },
        {
            key: 'aggregateStatus',
            label: 'Family Status',
            render: (row) => <StatusBadge status={row.aggregateStatus} />,
        },
    ]

    return (
        <div className='space-y-6'>
            <EntryClosureGate moduleName='Finance' actor='Account Head' />

            <StudentSearch
                students={students}
                academicYear={academicYear}
                onAcademicYearChange={setAcademicYear}
                selectedStudent={activeStudent}
                onSelectStudent={selectStudent}
            />

            {/* UNIFIED CONSOLE: Shown upfront when no student is actively selected */}
            {!activeStudent && (
                <section className='overflow-hidden rounded-2xl border border-[var(--erp-line)] bg-white shadow-sm' aria-labelledby='fee-collection-console-title'>
                    <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--erp-line)] p-4 sm:px-5'>
                        <div>
                            <h3 id='fee-collection-console-title' className='text-base font-bold text-[var(--erp-ink)]'>
                                Unified Fee Collection Console
                            </h3>
                            <p className='text-xs text-[var(--erp-muted)] mt-0.5'>
                                Real-time student & parent fee balances with 1-click collection selection.
                            </p>
                        </div>

                        <div className='flex items-center gap-2'>
                            <div className='inline-flex rounded-lg border border-[var(--erp-line-strong)] p-0.5 bg-[var(--erp-canvas)]'>
                                <button
                                    type='button'
                                    onClick={() => setConsoleView('student')}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                        consoleView === 'student' ? 'bg-white text-[var(--erp-indigo)] shadow-xs' : 'text-[var(--erp-slate)]'
                                    }`}
                                >
                                    <User size={13} />
                                    <span>Student-wise View</span>
                                </button>
                                <button
                                    type='button'
                                    onClick={() => setConsoleView('parent')}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                        consoleView === 'parent' ? 'bg-white text-[var(--erp-indigo)] shadow-xs' : 'text-[var(--erp-slate)]'
                                    }`}
                                >
                                    <Users size={13} />
                                    <span>Parent-wise View</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {consoleView === 'student' ? (
                        <DataTable
                            caption='Student fee collection register'
                            rows={studentRows}
                            columns={studentColumns}
                            rowKey='id'
                            emptyTitle='No students found'
                            emptyDescription='No student records match the active criteria.'
                            renderActions={(row) => (
                                <button
                                    type='button'
                                    onClick={() => selectStudent(row.rawStudent)}
                                    className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--erp-indigo)] text-white text-xs font-semibold hover:opacity-90 cursor-pointer shadow-xs'
                                >
                                    <Wallet size={13} />
                                    <span>Collect</span>
                                </button>
                            )}
                        />
                    ) : (
                        <DataTable
                            caption='Parent family fee collection register'
                            rows={parentRows}
                            columns={parentColumns}
                            rowKey='id'
                            emptyTitle='No parent records found'
                            emptyDescription='No family groups found in the active roster.'
                            renderActions={(row) => (
                                <div className='flex items-center gap-1.5 flex-wrap'>
                                    {row.children.map((c) => (
                                        <button
                                            key={c.id}
                                            type='button'
                                            onClick={() => selectStudent(c.rawStudent)}
                                            className='inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--erp-indigo)] text-white text-xs font-semibold hover:opacity-90 cursor-pointer shadow-xs'
                                            title={`Collect fees for ${c.studentName}`}
                                        >
                                            <Wallet size={12} />
                                            <span>Collect {c.studentName.split(' ')[0]}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        />
                    )}
                </section>
            )}

            {activeStudent && (
                <>
                    <div className='flex items-center justify-between p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl'>
                        <div className='flex items-center gap-2'>
                            <button
                                type='button'
                                onClick={() => selectStudent(null)}
                                className='inline-flex items-center gap-1 text-xs font-semibold text-[var(--erp-indigo)] bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 cursor-pointer shadow-xs'
                            >
                                <ArrowLeft size={13} />
                                <span>Back to All Students & Families</span>
                            </button>
                            <span className='text-xs text-[var(--erp-slate)] font-medium'>
                                Active Student: <strong className='text-[var(--erp-ink)]'>{activeStudent.name}</strong> ({activeStudent.className}-{activeStudent.section})
                            </span>
                        </div>
                        <div className='flex items-center gap-2'>
                            <span className='inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200'>
                                <CheckCircle2 size={13} />
                                <span>Synced · Finance Ledger</span>
                            </span>
                        </div>
                    </div>

                    <StudentFeeProfile
                        student={activeStudent}
                        siblings={siblings}
                        onViewSiblings={() => { setSiblingSelection([]); setSiblingsOpen(true) }}
                    />
                    <StudentFeeSummary summary={summary} />

                    <div className='flex flex-wrap gap-2'>
                        <button type='button' onClick={() => setHistoryOpen(true)} className='inline-flex items-center gap-2 text-sm border border-[#515DEF] text-[#515DEF] px-4 py-2 rounded-md cursor-pointer hover:bg-indigo-50'>
                            <History size={16} /> Payment History
                        </button>
                        <button type='button' disabled title='Payment links require a connected payment gateway.' className='inline-flex items-center gap-2 rounded-md border border-[var(--erp-line-strong)] px-4 py-2 text-sm text-[var(--erp-muted)] opacity-60'>
                            <Link2 size={16} /> Payment link unavailable
                        </button>
                    </div>

                    {grouped.map((group) => (
                        <div key={group.label} className='space-y-3'>
                            <h3 className='text-base font-semibold text-[#1E1E1E]'>{group.label}</h3>
                            <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
                                {group.items.map((item) => (
                                    <div key={item.id} className='space-y-2'>
                                        <FeeInstallmentCard
                                            installment={item}
                                            selected={selectedIds.includes(item.id)}
                                            onToggle={toggleInstallment}
                                            partialAmount={partials[item.id]}
                                            onPartialAmountChange={(id, value) => setPartials((prev) => ({ ...prev, [id]: Number(value) }))}
                                            allowPartial
                                        />
                                        {item.fineAmount > 0 && item.status !== FEE_INSTALLMENT_STATUSES.PAID && (
                                            <div className='flex gap-2'>
                                                <input
                                                    value={waiverReason}
                                                    onChange={(event) => setWaiverReason(event.target.value)}
                                                    placeholder='Fine waiver reason'
                                                    className='flex-1 text-sm border border-[#D9D9D9] rounded-md px-3 py-2'
                                                />
                                                <button type='button' onClick={() => handleWaive(item.id)} className='text-sm text-[#515DEF] border border-[#515DEF] px-3 py-2 rounded-md cursor-pointer'>
                                                    Waive fine
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className='sticky bottom-3 bg-white rounded-2xl shadow-md p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-[var(--erp-line)]'>
                        <div className='text-sm text-[#667085] space-y-0.5'>
                            <p>Selected net {formatCurrency(Math.max(0, totalAmount - lateFee))} · Late fee {formatCurrency(lateFee)}</p>
                            <p className='text-lg font-semibold text-[#1E1E1E]'>Total Amount {formatCurrency(totalAmount)}</p>
                        </div>
                        <button
                            type='button'
                            disabled={!totalAmount}
                            onClick={() => setPaymentOpen(true)}
                            className='inline-flex items-center justify-center gap-2 bg-[#515DEF] text-white px-5 py-2.5 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#434dbd]'
                        >
                            <Wallet size={16} /> Pay / Collect
                        </button>
                    </div>
                </>
            )}

            {paymentOpen && (
                <FeePaymentModal
                    onClose={() => setPaymentOpen(false)}
                    student={activeStudent}
                    allocations={allocations}
                    totalAmount={totalAmount}
                    lateFee={lateFee}
                    onConfirm={handleCollectResult}
                    bankAccounts={bankAccounts}
                    posTerminals={posTerminals}
                />
            )}
            <SiblingFeesDrawer
                isOpen={siblingsOpen}
                onClose={() => setSiblingsOpen(false)}
                currentStudent={activeStudent}
                siblings={siblings}
                summaries={siblingSummaries}
                selectedIds={siblingSelection}
                onToggle={(id) => setSiblingSelection((prev) => (
                    prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
                ))}
                onApply={() => {
                    if (!siblingSelection.length) {
                        toast.info('No sibling selected. Sibling dues are never auto-charged.')
                        setSiblingsOpen(false)
                        return
                    }
                    const next = getStudentById(siblingSelection[0])
                    selectStudent(next)
                    setSiblingsOpen(false)
                    toast.info(`Switched to ${next.name}. Select instalments manually.`)
                }}
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
                student={activeStudent}
                onReprint={reprintReceipt}
                onPrint={printReceipt}
            />
        </div>
    )
}

export default FeeCollectionTab
