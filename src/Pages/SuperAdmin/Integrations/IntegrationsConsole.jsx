import { useMemo, useState } from 'react'
import { PageHeader, Surface, IntegrationNotice } from '../../../Common/ui'

const CHANNELS = [
  {
    id: 'iclock',
    name: 'RFID / iClock attendance',
    clientRule: 'Auto attendance punches; no punch = Absent; leave/permission sync.',
    envHints: ['ICLOCK_BASE_URL', 'ICLOCK_API_KEY', 'webhooks /api/v1/webhooks/*'],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business (bills / temp passwords)',
    clientRule: 'Fee bills and admission portal temp passwords via WhatsApp.',
    envHints: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID', 'INTEGRATIONS_MODE=live'],
  },
  {
    id: 'paytm',
    name: 'Paytm POS / payment gateway',
    clientRule: 'Fee collection via POS and online gateway.',
    envHints: ['PAYTM_MID', 'PAYTM_MERCHANT_KEY', 'payments.create_payment_intent'],
  },
  {
    id: 'gps',
    name: 'Transport GPS (ProTrack)',
    clientRule: 'Live GPS on every bus; parent/student track after fee sync.',
    envHints: ['PROTRACK_API_URL', 'PROTRACK_TOKEN', '/api/v1/protrack'],
  },
  {
    id: 'email',
    name: 'SMTP email',
    clientRule: 'Temp passwords, MD daily digest ~08:00, notifications.',
    envHints: ['SMTP_HOST', 'SMTP_FROM', 'SMTP_USER', 'SMTP_PASSWORD'],
  },
  {
    id: 'bank',
    name: 'Bank rails (proposed)',
    clientRule: 'Payroll / vendor payouts after HR mark-paid.',
    envHints: ['BANK_API_URL (proposed)'],
  },
]

function readConfigured(hints = []) {
  // Browser cannot read server env; show honest NOT_CONFIGURED until Admin wires live.
  return hints.some((h) => {
    try {
      return Boolean(import.meta.env?.[`VITE_${h}`])
    } catch {
      return false
    }
  })
}

/**
 * Client Admin doc: integrations console for iClock, Paytm, WhatsApp, Email, GPS, Bank.
 * Config changes should require MD approval in production — shown as policy notice.
 */
export default function IntegrationsConsole() {
  const [selected, setSelected] = useState(CHANNELS[0].id)
  const active = useMemo(() => CHANNELS.find((c) => c.id === selected) || CHANNELS[0], [selected])
  const configured = readConfigured(active.envHints)

  return (
    <section className='space-y-5'>
      <PageHeader
        title='Integrations console'
        description='Client Admin pack: iClock/RFID, WhatsApp, Paytm, Email, GPS, Bank. Config changes require MD approval.'
      />
      <aside className='rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950'>
        <p className='font-semibold'>MD approval required for config changes</p>
        <p className='mt-1 text-xs'>Roles, workflows, integrations, and restore operations need Managing Director approval before go-live.</p>
      </aside>
      <div className='grid gap-4 lg:grid-cols-[240px_1fr]'>
        <Surface className='p-2'>
          <ul className='space-y-1'>
            {CHANNELS.map((ch) => (
              <li key={ch.id}>
                <button
                  type='button'
                  onClick={() => setSelected(ch.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    selected === ch.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                  }`}
                >
                  {ch.name}
                </button>
              </li>
            ))}
          </ul>
        </Surface>
        <Surface className='space-y-4 p-5'>
          <h2 className='text-lg font-semibold text-slate-900'>{active.name}</h2>
          <p className='text-sm text-slate-600'>{active.clientRule}</p>
          <IntegrationNotice
            state={configured ? 'connected' : 'failed'}
            title={configured ? 'Frontend hint present' : 'NOT_CONFIGURED on server'}
            description={
              configured
                ? 'A VITE_* hint exists in this build. Confirm FastAPI INTEGRATIONS_MODE=live and provider credentials.'
                : `Wire backend env: ${active.envHints.join(', ')}. Until then delivery stays stub / demo outbox.`
            }
          />
          <div>
            <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>Provider keys / endpoints</p>
            <ul className='mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700'>
              {active.envHints.map((hint) => (
                <li key={hint}><code>{hint}</code></li>
              ))}
            </ul>
          </div>
          <p className='text-xs text-slate-500'>
            Live providers are owned by FastAPI `app/services/integrations/*` and `/api/v1/webhooks` / `/api/v1/protrack`.
            This console documents client coverage; it does not invent credentials.
          </p>
        </Surface>
      </div>
    </section>
  )
}
