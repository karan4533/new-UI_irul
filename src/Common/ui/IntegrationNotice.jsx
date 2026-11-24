import { CheckCircle2, CircleAlert, CircleDashed, FlaskConical, RefreshCw } from 'lucide-react'
import { getIntegrationState } from './feedback'
import { getStatusTone } from './tokens'

const ICONS = {
    demo: FlaskConical,
    disconnected: CircleDashed,
    syncing: RefreshCw,
    connected: CheckCircle2,
    failed: CircleAlert,
}

/** Dev/staging only. Production UI stays clean. */
export function showIntegrationDiagnostics() {
    try {
        return String(import.meta.env?.VITE_SHOW_INTEGRATION_NOTICES || '').toLowerCase() === 'true'
    } catch {
        return false
    }
}

const IntegrationNotice = ({ state = 'disconnected', title, description, action, className = '' }) => {
    // Always suppress non-error banners unless explicitly enabled for staging audits.
    // Keep `failed` visible so users still see real outages.
    if (state !== 'failed' && !showIntegrationDiagnostics()) {
        return null
    }
    if (state === 'demo' || state === 'disconnected') {
        return null
    }
    const integration = state === 'mock'
        ? { state: 'mock', title: 'Browser mock data', description: 'This screen is not writing to the live API.', tone: 'warning' }
        : getIntegrationState(state)
    const tone = getStatusTone(integration.tone)
    const Icon = state === 'mock' ? FlaskConical : (ICONS[integration.state] || CircleDashed)

    return (
        <aside
            className={`flex items-start gap-3 rounded-[var(--erp-radius-surface)] border p-3.5 ${className}`}
            style={{ backgroundColor: tone.background, borderColor: tone.border }}
            aria-label={title || integration.title}
        >
            <Icon
                aria-hidden='true'
                className={integration.state === 'syncing' ? 'mt-0.5 shrink-0 animate-spin motion-reduce:animate-none' : 'mt-0.5 shrink-0'}
                size={18}
                style={{ color: tone.foreground }}
            />
            <div className='min-w-0 flex-1'>
                <p className='text-sm font-semibold' style={{ color: tone.foreground }}>
                    {title || integration.title}
                </p>
                <p className='mt-0.5 text-sm text-[var(--erp-slate)]'>
                    {description || integration.description}
                </p>
            </div>
            {action && <div className='shrink-0'>{action}</div>}
        </aside>
    )
}

export default IntegrationNotice
