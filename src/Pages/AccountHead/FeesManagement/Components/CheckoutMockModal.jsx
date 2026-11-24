import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { CreditCard, Smartphone } from 'lucide-react'
import { PAYMENT_MODES } from '../../financeDomain/financeConstants'
import { formatCurrency } from '../../financeDomain/financeHelpers'
import IntegrationNotice from '../../../../Common/ui/IntegrationNotice'
import Dialog from '../../../../Common/ui/Dialog'
import { isLiveApiEnabled } from '../../../../services/api/tokenStore'

/**
 * Mode picker for online checkout.
 * When live: does NOT invent gateway success — only collects paymentMode and hands off to onSuccess (API).
 * When mock: simulates a gateway capture for demo only.
 */
const CheckoutMockModal = ({ isOpen, onClose, amount, student, onSuccess, onFail }) => {
    const live = isLiveApiEnabled()
    const [busy, setBusy] = useState(false)
    if (!isOpen) return null

    const pay = async (mode) => {
        setBusy(true)
        const payload = {
            paymentMode: mode,
            details: {
                transactionReference: live ? undefined : `RZP-${Date.now().toString().slice(-8)}`,
                paymentDate: new Date().toISOString().slice(0, 10),
                narration: `Online ${mode === PAYMENT_MODES.UPI ? 'UPI' : 'Card'} checkout — ${student?.name ?? ''}`,
            },
        }

        if (live) {
            try {
                const result = await onSuccess?.(payload)
                if (result?.success === false) {
                    onFail?.()
                    return
                }
                toast.success('Payment recorded on the server.')
                onClose()
            } catch (err) {
                toast.error(err?.message || 'Payment failed.')
                onFail?.()
            } finally {
                setBusy(false)
            }
            return
        }

        window.setTimeout(() => {
            const ok = Math.random() > 0.08
            if (!ok) {
                toast.error('Mock gateway declined the payment. Try again.')
                onFail?.()
                setBusy(false)
                return
            }
            onSuccess?.(payload)
            toast.success('Mock payment successful (browser only).')
            setBusy(false)
            onClose()
        }, 900)
    }

    return (
        <Dialog open={isOpen} onClose={onClose} title='Checkout' description={`${formatCurrency(amount)}.00 · Pay School Trust`} size='sm'>
                <div className='space-y-3'>
                    <IntegrationNotice
                        state={live ? 'connected' : 'mock'}
                        title={live ? 'Live fee payment' : 'Simulated checkout'}
                        description={live
                            ? 'Payment mode is sent to POST /api/v1/finance/actions/pay-my-fees. No client-side success without the API.'
                            : 'No payment gateway is contacted and no money is transferred. Browser demo only.'}
                    />
                    <button
                        type='button'
                        disabled={busy}
                        onClick={() => pay(PAYMENT_MODES.CARD_ONLINE)}
                        className='w-full flex items-center gap-3 border border-[#EDEEF5] rounded-xl px-4 py-3 text-left cursor-pointer hover:border-[#515DEF] disabled:opacity-60'
                    >
                        <CreditCard className='text-[#515DEF]' size={20} />
                        <span>Card</span>
                    </button>
                    <button
                        type='button'
                        disabled={busy}
                        onClick={() => pay(PAYMENT_MODES.UPI)}
                        className='w-full flex items-center gap-3 border border-[#EDEEF5] rounded-xl px-4 py-3 text-left cursor-pointer hover:border-[#515DEF] disabled:opacity-60'
                    >
                        <Smartphone className='text-[#515DEF]' size={20} />
                        <span>UPI</span>
                    </button>
                    {busy && <p className='text-xs text-[#808080] text-center'>{live ? 'Submitting to finance API…' : 'Contacting mock gateway...'}</p>}
                </div>
        </Dialog>
    )
}

export default CheckoutMockModal
