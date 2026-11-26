import { useState } from 'react'
import { Check } from 'lucide-react'
import { ConfirmAction, Dialog, IntegrationNotice } from '../../../../Common/ui'
import { formatRupeeAmount } from '../walletManagementData'

const fieldClass = 'min-h-11 w-full rounded-lg border border-[var(--erp-line-strong)] px-3 text-sm focus:border-[var(--erp-indigo)] focus:outline-none'

const newReference = () => `REC-${Date.now().toString(36).toUpperCase()}`

const RechargeWalletModal = ({ isOpen, onClose, onOfflineRecharge, live = false }) => {
    const [email, setEmail] = useState('')
    const [amount, setAmount] = useState('')
    const [mode, setMode] = useState('CASH')
    const [reference, setReference] = useState(newReference)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [confirmOpen, setConfirmOpen] = useState(false)

    const closeModal = () => {
        setEmail('')
        setAmount('')
        setMode('CASH')
        setReference(newReference())
        setSubmitting(false)
        setError('')
        setConfirmOpen(false)
        onClose()
    }

    const validateAndReview = (event) => {
        event.preventDefault()
        const rechargeAmount = Number(amount)
        if (!email.trim()) return setError('Enter the wallet owner email ID.')
        if (!Number.isFinite(rechargeAmount) || rechargeAmount <= 0) return setError('Enter an amount greater than zero.')
        if (live && !reference.trim()) return setError('Enter the receipt / reference number.')
        setError('')
        setConfirmOpen(true)
    }

    const confirmCredit = async () => {
        if (submitting) return
        setSubmitting(true)
        const result = await onOfflineRecharge({ email: email.trim().toLowerCase(), amount: Number(amount), mode, reference: reference.trim() })
        setSubmitting(false)
        if (!result.success) {
            setError(result.message)
            setConfirmOpen(false)
            return
        }
        setConfirmOpen(false)
        closeModal()
    }

    return (
        <>
            <Dialog
                open={isOpen}
                onClose={closeModal}
                title='Record wallet credit'
                description={live ? 'Record independently verified cash, cheque or bank-transfer money received for a wallet. Online gateway payments are not connected.' : 'Record independently verified cash received for a browser-stored wallet.'}
                size='sm'
                footer={(
                    <>
                        <button type='button' onClick={closeModal} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] px-4 text-sm font-semibold text-[var(--erp-ink)]'>Cancel</button>
                        <button type='submit' form='wallet-credit-form' className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white'><Check aria-hidden='true' size={16} /> Review credit</button>
                    </>
                )}
            >
                <form id='wallet-credit-form' onSubmit={validateAndReview} className='space-y-4'>
                    <IntegrationNotice state={live ? 'connected' : 'demo'} title='No payment is initiated' description={live ? 'This records the credit on the campus ledger with a receipt voucher. It never contacts a gateway or bank.' : 'This action records a local cash credit and creates browser-stored finance entries. It never contacts a gateway or bank.'} />
                    <label className='grid gap-1.5 text-sm font-semibold text-[var(--erp-ink)]'>Wallet owner email
                        <input type='email' required value={email} onChange={(event) => setEmail(event.target.value)} placeholder='user@school.com' className={fieldClass} />
                    </label>
                    <label className='grid gap-1.5 text-sm font-semibold text-[var(--erp-ink)]'>Cash amount received (₹)
                        <input type='number' min='1' step='1' required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder='Enter amount' className={fieldClass} />
                    </label>
                    {live ? (
                        <>
                            <label className='grid gap-1.5 text-sm font-semibold text-[var(--erp-ink)]'>Payment mode
                                <select value={mode} onChange={(event) => setMode(event.target.value)} className={fieldClass}>
                                    <option value='CASH'>Cash</option>
                                    <option value='CHEQUE'>Cheque</option>
                                    <option value='BANK_TRANSFER'>Bank transfer</option>
                                </select>
                            </label>
                            <label className='grid gap-1.5 text-sm font-semibold text-[var(--erp-ink)]'>Receipt / reference no.
                                <input type='text' required value={reference} onChange={(event) => setReference(event.target.value)} className={fieldClass} />
                            </label>
                        </>
                    ) : null}
                    {error ? <p role='alert' className='rounded-lg border border-[#F6C9BD] bg-[#FFF5F2] px-3 py-2 text-sm text-[var(--erp-red)]'>{error}</p> : null}
                </form>
            </Dialog>

            <ConfirmAction
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={confirmCredit}
                title={`Credit ${formatRupeeAmount(Number(amount) || 0)} to this wallet?`}
                description={live ? 'This credits the wallet once (the reference is the idempotency key) and posts a balanced receipt voucher.' : 'This updates the browser-stored balance and creates a local cash inflow. Production must enforce wallet ownership, permissions, idempotency and immutable audit history.'}
                confirmLabel={live ? 'Confirm credit' : 'Confirm local credit'}
                confirmDisabled={submitting}
            >
                <p><span className='font-semibold text-[var(--erp-ink)]'>Wallet owner:</span> {email.trim() || 'Not entered'}</p>
            </ConfirmAction>
        </>
    )
}

export default RechargeWalletModal
