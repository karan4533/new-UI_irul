import { CheckCircle2, CircleAlert, CircleDashed, Database, FlaskConical, HardDrive } from 'lucide-react'
import { showIntegrationDiagnostics } from './IntegrationNotice'
import { getStatusTone } from './tokens'

/**
 * Honest module-level data-source badge for LIVE vs MOCK/PARTIAL screens.
 * Hidden in production UI unless VITE_SHOW_INTEGRATION_NOTICES=true.
 */
const VARIANTS = Object.freeze({
    LIVE: {
        label: 'LIVE',
        tone: 'success',
        Icon: CheckCircle2,
        defaultDetail: 'Connected to FastAPI for the operations shown on this screen.',
    },
    PARTIAL: {
        label: 'PARTIAL',
        tone: 'warning',
        Icon: CircleAlert,
        defaultDetail: 'Some operations use the backend; others are still local or demo-only.',
    },
    MOCK: {
        label: 'MOCK',
        tone: 'warning',
        Icon: FlaskConical,
        defaultDetail: 'Screen uses demo or hardcoded sample data — not authoritative backend records.',
    },
    'LOCAL ONLY': {
        label: 'LOCAL ONLY',
        tone: 'neutral',
        Icon: HardDrive,
        defaultDetail: 'Data is stored in this browser (localStorage/session). It will not sync to the server.',
    },
    UNAVAILABLE: {
        label: 'UNAVAILABLE',
        tone: 'danger',
        Icon: CircleDashed,
        defaultDetail: 'Backend operation is not implemented or not accessible for this role.',
    },
})

export default function DataSourceIndicator({
    status = 'MOCK',
    detail,
    className = '',
    compact = false,
}) {
    if (!showIntegrationDiagnostics()) {
        return null
    }
    const variant = VARIANTS[status] || VARIANTS.MOCK
    const tone = getStatusTone(variant.tone)
    const Icon = variant.Icon || Database
    const description = detail || variant.defaultDetail

    return (
        <aside
            className={`flex items-start gap-2.5 rounded-[var(--erp-radius-surface)] border px-3 py-2.5 ${className}`}
            style={{ backgroundColor: tone.background, borderColor: tone.border }}
            role='status'
            aria-label={`Data source: ${variant.label}`}
        >
            <Icon aria-hidden='true' className='mt-0.5 shrink-0' size={16} style={{ color: tone.foreground }} />
            <div className='min-w-0 flex-1'>
                <p className='text-xs font-bold tracking-wide' style={{ color: tone.foreground }}>
                    {variant.label}
                </p>
                {!compact && (
                    <p className='mt-0.5 text-xs leading-snug text-[var(--erp-slate)]'>{description}</p>
                )}
            </div>
        </aside>
    )
}

export { VARIANTS as DATA_SOURCE_VARIANTS }
