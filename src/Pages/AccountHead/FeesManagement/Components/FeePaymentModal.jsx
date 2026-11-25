import { useState } from 'react'
import { IndianRupee } from 'lucide-react'
import { toast } from 'react-toastify'
import { ConfirmAction, Dialog, IntegrationNotice } from '../../../../Common/ui'
import { PAYMENT_MODE_OPTIONS, PAYMENT_MODES, paymentModeLabel } from '../../financeDomain/financeConstants'
import { formatCurrency, toIsoDate } from '../../financeDomain/financeHelpers'
import PaymentModeFields from './PaymentModeFields'

const RECORDABLE_MODES = PAYMENT_MODE_OPTIONS.filter((item) => [
    PAYMENT_MODES.CASH,
    PAYMENT_MODES.CHEQUE,
    PAYMENT_MODES.BANK_TRANSFER,
].includes(item.id))

const buildDetails = (student) => {
    const today = toIsoDate(new Date())
    return {
        receivedBy: 'Finance Head',
        paymentDate: today,
        transactionDate: today,
        receivedDate: today,
        narration: student ? `Fee collection — ${student.name}` : '',
        sendWhatsAppReceipt: true,
        whatsappMobile: student?.parentMobile || student?.mobileNumber || '+91 98450 12345',
    }
}

const FeePaymentModal = ({
    onClose,
    student,
    allocations,
    totalAmount,
    lateFee,
    onConfirm,
    bankAccounts,
    posTerminals,
}) => {
    const [mode, setMode] = useState(PAYMENT_MODES.CASH)
    const [details, setDetails] = useState(() => buildDetails(student))
    const [reviewOpen, setReviewOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const payableLabel = formatCurrency(totalAmount)

    const handleSubmit = async () => {
        if (submitting) return
        setSubmitting(true)
        try {
            const result = await onConfirm({
                paymentMode: mode,
                details: { ...details, transactionDate: details.transactionDate || details.paymentDate },
                paymentDate: details.paymentDate || details.transactionDate,
                narration: details.narration,
            })
            if (!result?.success) {
                toast.error(result?.errors?.[0] || result?.message || 'Unable to record the collection.')
                setReviewOpen(false)
                return
            }
            if (result.held) toast.info(`Cheque recorded as ${result.transaction?.chequeDetails?.status}. Fee will update after clearance.`)
            else {
                toast.success(
                    result.dataSource === 'backend'
                        ? `Server confirmed ${payableLabel}. Receipt ${result.receipt?.receiptNo || ''}`
                        : `Recorded ${payableLabel}. Receipt ${result.receipt?.receiptNo}`,
                )
                const portal = result.studentPortal
                if (portal?.temporary_password || portal?.temporaryPassword) {
                    const email = portal.email || 'student mailbox'
                    const pwd = portal.temporary_password || portal.temporaryPassword
                    toast.success(
                        `Student portal created after admission payment: ${email} / temp password ${pwd}. Parent access is via the student profile only.`,
                        { autoClose: 12000 },
                    )
                } else if (portal?.message) {
                    toast.info(portal.message, { autoClose: 8000 })
                } else if (portal?.error) {
                    toast.warning('Fee posted, but student portal was not provisioned. Use Finance → provision admission portal.', { autoClose: 8000 })
                }
                if (details.sendWhatsAppReceipt) {
                    toast.info(
                        result.dataSource === 'backend'
                            ? 'Receipt send uses the finance send-receipt API (may queue as stub until messaging keys are configured).'
                            : `Instant WhatsApp e-Receipt delivered to ${details.whatsappMobile}`,
                    )
                }
            }
            setReviewOpen(false)
            onClose()
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <Dialog
                open
                onClose={onClose}
                title='Record fee collection'
                description={`${student?.name || 'Selected student'} · ${payableLabel}`}
                size='lg'
                footer={(
                    <>
                        <button type='button' onClick={onClose} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] px-4 text-sm font-semibold text-[var(--erp-ink)]'>Cancel</button>
                        <button type='button' onClick={() => setReviewOpen(true)} disabled={!allocations.length || totalAmount <= 0} className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white disabled:opacity-50'><IndianRupee aria-hidden='true' size={16} /> Review collection</button>
                    </>
                )}
            >
                <div className='space-y-5'>
                    <IntegrationNotice
                        state='disconnected'
                        title='Does not initiate a bank transfer'
                        description='Confirm only after verifying cash, cheque or bank-transfer evidence. In live mode the campus finance API records the collection; gateway rails remain stubbed.'
                    />
                    <dl className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                        <div className='rounded-xl bg-[var(--erp-canvas)] p-3'><dt className='text-xs text-[var(--erp-muted)]'>Selected net</dt><dd className='font-semibold text-[var(--erp-ink)]'>{formatCurrency(totalAmount - lateFee)}</dd></div>
                        <div className='rounded-xl bg-[var(--erp-canvas)] p-3'><dt className='text-xs text-[var(--erp-muted)]'>Late fee</dt><dd className='font-semibold text-[var(--erp-red)]'>{formatCurrency(lateFee)}</dd></div>
                        <div className='col-span-2 rounded-xl bg-[#F4F4FF] p-3'><dt className='text-xs text-[var(--erp-muted)]'>Total recording</dt><dd className='text-lg font-semibold text-[var(--erp-indigo)]'>{payableLabel}</dd></div>
                    </dl>

                    <fieldset>
                        <legend className='mb-2 text-sm font-semibold text-[var(--erp-ink)]'>Received payment mode</legend>
                        <div className='flex flex-wrap gap-2'>
                            {RECORDABLE_MODES.map((item) => (
                                <button key={item.id} type='button' onClick={() => setMode(item.id)} aria-pressed={mode === item.id} className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${mode === item.id ? 'border-[var(--erp-indigo)] bg-[var(--erp-indigo)] text-white' : 'border-[var(--erp-line-strong)] bg-white text-[var(--erp-slate)]'}`}>{item.label}</button>
                            ))}
                        </div>
                    </fieldset>

                    <PaymentModeFields mode={mode} values={details} onChange={setDetails} bankAccounts={bankAccounts} posTerminals={posTerminals} />
                    
                    <div className='flex items-center gap-3 p-3 rounded-xl bg-[#F0FDF4] border border-[#DCFCE7]'>
                        <input
                            type='checkbox'
                            id='whatsapp-receipt'
                            checked={Boolean(details.sendWhatsAppReceipt)}
                            onChange={(e) => setDetails({ ...details, sendWhatsAppReceipt: e.target.checked })}
                            className='h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer'
                        />
                        <label htmlFor='whatsapp-receipt' className='text-sm font-medium text-green-900 cursor-pointer flex-1'>
                            Dispatch digital fee receipt via WhatsApp to parent ({details.whatsappMobile})
                        </label>
                    </div>

                    <p className='text-sm text-[var(--erp-slate)]'>{allocations.length} instalment{allocations.length === 1 ? '' : 's'} selected</p>
                </div>
            </Dialog>

            <ConfirmAction
                open={reviewOpen}
                onClose={() => setReviewOpen(false)}
                onConfirm={handleSubmit}
                title={`Record ${payableLabel} as received?`}
                description='This updates the browser-stored fee balance and may create a receipt and accounting entries. It does not move money through a connected financial service.'
                confirmLabel='Confirm local collection'
                busy={submitting}
            >
                <dl className='grid gap-2'>
                    <div><dt className='text-xs text-[var(--erp-muted)]'>Student</dt><dd className='font-semibold text-[var(--erp-ink)]'>{student?.name || 'Not recorded'}</dd></div>
                    <div><dt className='text-xs text-[var(--erp-muted)]'>Mode</dt><dd className='font-semibold text-[var(--erp-ink)]'>{paymentModeLabel(mode)}</dd></div>
                    <div><dt className='text-xs text-[var(--erp-muted)]'>Instalments</dt><dd className='font-semibold text-[var(--erp-ink)]'>{allocations.length}</dd></div>
                </dl>
            </ConfirmAction>
        </>
    )
}

export default FeePaymentModal
