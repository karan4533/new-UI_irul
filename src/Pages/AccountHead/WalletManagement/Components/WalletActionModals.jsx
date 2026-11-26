import { useState } from 'react'
import { Check } from 'lucide-react'
import { Dialog } from '../../../../Common/ui'

const fieldClass = 'min-h-11 w-full rounded-lg border border-[var(--erp-line-strong)] px-3 text-sm focus:border-[var(--erp-indigo)] focus:outline-none'
const cancelClass = 'min-h-10 rounded-lg border border-[var(--erp-line-strong)] px-4 text-sm font-semibold text-[var(--erp-ink)]'
const submitClass = 'inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white disabled:opacity-50'

const newBill = () => `BILL-${Date.now().toString(36).toUpperCase()}`

export const OpenWalletModal = ({ isOpen, onClose, onSubmit }) => {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [role, setRole] = useState('Student')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const close = () => {
        setName('')
        setEmail('')
        setRole('Student')
        setError('')
        setSubmitting(false)
        onClose()
    }

    const submit = async (event) => {
        event.preventDefault()
        if (!name.trim()) return setError('Enter the wallet owner name.')
        if (!email.trim()) return setError('Enter the wallet owner email ID.')
        setSubmitting(true)
        const result = await onSubmit({ name: name.trim(), email: email.trim().toLowerCase(), role })
        setSubmitting(false)
        if (!result.success) return setError(result.message)
        return close()
    }

    return (
        <Dialog
            open={isOpen}
            onClose={close}
            title='Open wallet'
            description='Create a school wallet for a student, staff member or parent. One wallet per email.'
            size='sm'
            footer={(
                <>
                    <button type='button' onClick={close} className={cancelClass}>Cancel</button>
                    <button type='submit' form='wallet-open-form' disabled={submitting} className={submitClass}><Check aria-hidden='true' size={16} /> Open wallet</button>
                </>
            )}
        >
            <form id='wallet-open-form' onSubmit={submit} className='space-y-4'>
                <label className='grid gap-1.5 text-sm font-semibold text-[var(--erp-ink)]'>Owner name
                    <input type='text' required value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
                </label>
                <label className='grid gap-1.5 text-sm font-semibold text-[var(--erp-ink)]'>Owner email
                    <input type='email' required value={email} onChange={(event) => setEmail(event.target.value)} placeholder='user@school.com' className={fieldClass} />
                </label>
                <label className='grid gap-1.5 text-sm font-semibold text-[var(--erp-ink)]'>Role
                    <select value={role} onChange={(event) => setRole(event.target.value)} className={fieldClass}>
                        <option>Student</option>
                        <option>Staff</option>
                        <option>Parent</option>
                    </select>
                </label>
                {error ? <p role='alert' className='rounded-lg border border-[#F6C9BD] bg-[#FFF5F2] px-3 py-2 text-sm text-[var(--erp-red)]'>{error}</p> : null}
            </form>
        </Dialog>
    )
}

export const SpendWalletModal = ({ isOpen, onClose, onSubmit }) => {
    const [email, setEmail] = useState('')
    const [amount, setAmount] = useState('')
    const [vendor, setVendor] = useState('')
    const [category, setCategory] = useState('Canteen')
    const [reference, setReference] = useState(newBill)
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const close = () => {
        setEmail('')
        setAmount('')
        setVendor('')
        setCategory('Canteen')
        setReference(newBill())
        setError('')
        setSubmitting(false)
        onClose()
    }

    const submit = async (event) => {
        event.preventDefault()
        const value = Number(amount)
        if (!email.trim()) return setError('Enter the wallet owner email ID.')
        if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than zero.')
        if (!vendor.trim()) return setError('Enter the vendor / item.')
        if (!reference.trim()) return setError('Enter the POS bill reference.')
        setSubmitting(true)
        const result = await onSubmit({ email: email.trim().toLowerCase(), amount: value, vendor: vendor.trim(), category, reference: reference.trim() })
        setSubmitting(false)
        if (!result.success) return setError(result.message)
        return close()
    }

    return (
        <Dialog
            open={isOpen}
            onClose={close}
            title='Record wallet spend'
            description='Debit a wallet for a canteen, stationery or event purchase. The POS bill reference prevents double charging.'
            size='sm'
            footer={(
                <>
                    <button type='button' onClick={close} className={cancelClass}>Cancel</button>
                    <button type='submit' form='wallet-spend-form' disabled={submitting} className={submitClass}><Check aria-hidden='true' size={16} /> Record spend</button>
                </>
            )}
        >
            <form id='wallet-spend-form' onSubmit={submit} className='space-y-4'>
                <label className='grid gap-1.5 text-sm font-semibold text-[var(--erp-ink)]'>Wallet owner email
                    <input type='email' required value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
                </label>
                <label className='grid gap-1.5 text-sm font-semibold text-[var(--erp-ink)]'>Amount (₹)
                    <input type='number' min='1' step='0.01' required value={amount} onChange={(event) => setAmount(event.target.value)} className={fieldClass} />
                </label>
                <label className='grid gap-1.5 text-sm font-semibold text-[var(--erp-ink)]'>Vendor / item
                    <input type='text' required value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder='Canteen — Lunch' className={fieldClass} />
                </label>
                <label className='grid gap-1.5 text-sm font-semibold text-[var(--erp-ink)]'>Category
                    <select value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClass}>
                        <option>Canteen</option>
                        <option>Stationery</option>
                        <option>Events</option>
                        <option>Other</option>
                    </select>
                </label>
                <label className='grid gap-1.5 text-sm font-semibold text-[var(--erp-ink)]'>POS bill reference
                    <input type='text' required value={reference} onChange={(event) => setReference(event.target.value)} className={fieldClass} />
                </label>
                {error ? <p role='alert' className='rounded-lg border border-[#F6C9BD] bg-[#FFF5F2] px-3 py-2 text-sm text-[var(--erp-red)]'>{error}</p> : null}
            </form>
        </Dialog>
    )
}
