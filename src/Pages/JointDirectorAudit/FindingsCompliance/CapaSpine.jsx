import { Link } from 'react-router-dom'
import { PageHeader, Surface, IntegrationNotice } from '../../../Common/ui'
import { FINDINGS } from './findingsComplianceData'

const CAPA_STAGES = [
  'Finding raised',
  'RCA submitted',
  'CAPA plan',
  'Action evidence',
  'Independent verify',
  'Closure → BSC / HR',
]

/**
 * Client Audit overflow spine: plan → finding → RCA → CAPA → verify → closure → BSC/HR.
 */
export default function CapaSpine() {
  const rows = (Array.isArray(FINDINGS) ? FINDINGS : []).slice(0, 12)

  return (
    <section className='space-y-5'>
      <PageHeader
        title='CAPA spine'
        description='Client Audit flow: finding → RCA → CAPA → verification → closure, then BSC / HR performance link.'
      />
      <IntegrationNotice
        state='demo'
        title='Governance spine (frontend)'
        description='Stage progression below mirrors the client pack. Authoritative CAPA evidence and HR performance write-back require the audit backend.'
      />
      <Surface className='p-4'>
        <ol className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
          {CAPA_STAGES.map((stage, index) => (
            <li key={stage} className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm'>
              <span className='text-xs font-semibold text-slate-500'>{index + 1}</span>
              <p className='mt-1 font-semibold text-slate-900'>{stage}</p>
            </li>
          ))}
        </ol>
      </Surface>
      <Surface className='overflow-x-auto p-0'>
        <table className='w-full text-sm'>
          <thead className='bg-slate-50 text-xs uppercase text-slate-600'>
            <tr>
              <th className='px-4 py-3 text-left'>Finding</th>
              <th className='px-4 py-3 text-left'>Dept</th>
              <th className='px-4 py-3 text-left'>CAPA</th>
              <th className='px-4 py-3 text-left'>Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className='px-4 py-8 text-center text-slate-500'>No findings in local seed.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className='border-t border-slate-100'>
                  <td className='px-4 py-3 font-medium'>{row.title}</td>
                  <td className='px-4 py-3'>{row.department}</td>
                  <td className='px-4 py-3'>{row.capaStatus || '—'}</td>
                  <td className='px-4 py-3'>
                    <Link
                      to={`/joint-director-audit/findings-compliance/view/${row.id}`}
                      className='font-semibold text-[var(--erp-indigo)] hover:underline'
                    >
                      View CAPA →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Surface>
    </section>
  )
}
