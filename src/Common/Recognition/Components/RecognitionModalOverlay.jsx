import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Viewport-fixed modal shell for Recognition / SOM nomination dialogs.
 * Portals to document.body so AppShell sidebar (z-300) / header (z-200)
 * cannot cover or clip the overlay via stacking contexts.
 */
const RecognitionModalOverlay = ({
    open,
    onClose,
    children,
    panelClassName = 'max-w-4xl',
    labelledBy,
}) => {
    useEffect(() => {
        if (!open) return undefined
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const onKeyDown = (event) => {
            if (event.key === 'Escape' && typeof onClose === 'function') onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [open, onClose])

    if (!open || typeof document === 'undefined') return null

    return createPortal(
        <div
            className='fixed inset-0 z-[400] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150'
            role='presentation'
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && typeof onClose === 'function') onClose()
            }}
        >
            <div
                role='dialog'
                aria-modal='true'
                aria-labelledby={labelledBy}
                className={`bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-h-[min(92vh,900px)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 ${panelClassName}`}
                onMouseDown={(event) => event.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body,
    )
}

export default RecognitionModalOverlay
