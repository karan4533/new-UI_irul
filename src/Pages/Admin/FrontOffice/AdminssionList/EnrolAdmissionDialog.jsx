import { useEffect, useState } from 'react'
import Dialog from '../../../../Common/ui/Dialog'
import { getStudentDisplayName } from './admissionListData'

/**
 * Confirm academic enrolment only.
 * Client rules: no separate parent login; student portal created on Finance admission payment.
 */
const EnrolAdmissionDialog = ({
    open,
    record,
    busy = false,
    onClose,
    onConfirm,
}) => {
    const [formError, setFormError] = useState('')

    useEffect(() => {
        if (open) setFormError('')
    }, [open, record])

    const handleConfirm = () => {
        setFormError('')
        onConfirm?.({
            skipParentAccount: true,
            skipStudentAccount: true,
            parentAccountEmail: null,
            parentAccountPassword: null,
            studentAccountEmail: null,
            studentAccountPassword: null,
        })
    }

    const studentName = record ? getStudentDisplayName(record) : 'Student'

    return (
        <Dialog
            open={open}
            onClose={busy ? undefined : onClose}
            title='Enrol student'
            description='Places the student on UIS / class. Portal login is created later by Finance.'
            size='md'
            closeOnBackdrop={!busy}
            closeOnEscape={!busy}
            footer={(
                <>
                    <button
                        type='button'
                        onClick={() => onClose?.('cancel')}
                        disabled={busy}
                        className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-4 text-sm font-semibold text-[var(--erp-ink)] hover:bg-[var(--erp-canvas)]'
                    >
                        Cancel
                    </button>
                    <button
                        type='button'
                        onClick={handleConfirm}
                        disabled={busy}
                        className='min-h-10 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white disabled:opacity-60'
                    >
                        {busy ? 'Enrolling…' : 'Enrol student'}
                    </button>
                </>
            )}
        >
            <div className='space-y-4 text-sm'>
                <div className='rounded-xl border border-[var(--erp-line)] bg-[var(--erp-canvas)] p-3'>
                    <p className='font-semibold text-[var(--erp-ink)]'>{studentName}</p>
                    <p className='mt-1 text-[var(--erp-muted)]'>
                        {[record?.admissionNumber || record?.admissionCode, record?.className, record?.mobileNumber]
                            .filter(Boolean)
                            .join(' · ') || 'Admission ready to enrol'}
                    </p>
                </div>

                <div className='rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 space-y-1.5'>
                    <p className='font-semibold'>Client workflow (aligned)</p>
                    <ul className='list-disc pl-4 space-y-1'>
                        <li>Enrol creates the student UIS / class record only.</li>
                        <li>Student portal login is created after Finance admission payment (temp password).</li>
                        <li>Parent access is via the student profile — no separate parent login.</li>
                    </ul>
                </div>

                {formError ? (
                    <p className='rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700'>{formError}</p>
                ) : null}
            </div>
        </Dialog>
    )
}

export default EnrolAdmissionDialog
