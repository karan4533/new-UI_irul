import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Surface, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTcRequests } from '../../../services/api/tcApiService'
import { listEscalations } from '../../../services/api/escalationApiService'

const QUEUES = [
  { id: 'tc', title: 'TC final (MD)', href: '/admin/tc-request-approval', client: 'TC → NOCs → MD' },
  { id: 'escalations', title: 'Escalated complaints', href: '/director/escalation-management', client: '24h / Not Satisfied → MD' },
  { id: 'lesson', title: 'Lesson plans', href: '/director/lesson-plan-approval', client: 'Teacher→Coord→Principal→DA' },
  { id: 'marks', title: 'Mark entry', href: '/director/mark-entry-approval', client: 'Marks publish chain' },
  { id: 'exams', title: 'Exam timetable', href: '/director/examination-approvals', client: 'Principal→DA publish' },
  { id: 'requests', title: 'Request approvals', href: '/director/request-approvals', client: 'Cross-dept requests' },
]

/**
 * Client MD pack: Final Approvals Centre — TC, increment/exit (via HR), escalations, sensitive ops.
 * Director acts as MD-proxy in this product; records remain read-only after decide.
 */
export default function FinalApprovalsCentre() {
  const live = isLiveApiEnabled()
  const [tcPending, setTcPending] = useState(null)
  const [escPending, setEscPending] = useState(null)

  useEffect(() => {
    if (!live) return undefined
    let cancelled = false
    ;(async () => {
      const [tc, esc] = await Promise.all([listTcRequests(), listEscalations({ box: 'received' })])
      if (cancelled) return
      if (tc.success) {
        const rows = Array.isArray(tc.data) ? tc.data : []
        setTcPending(rows.filter((r) => String(r.status || '').includes('Pending')).length)
      }
      if (esc.success) {
        const rows = Array.isArray(esc.data) ? esc.data : []
        setEscPending(rows.filter((r) => !['Resolved', 'Closed'].includes(r.status)).length)
      }
    })()
    return () => { cancelled = true }
  }, [live])

  return (
    <section className='space-y-5'>
      <PageHeader
        title='Final Approvals Centre'
        description='Client MD workflow: final decisions for TC, escalations, academic publishes. MD cannot edit/delete business records — approve or reject only.'
      />
      <aside className='rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800'>
        <p className='font-semibold'>Read-only business data</p>
        <p className='mt-1 text-xs'>Corrections require new dated actions. Config changes need MD approval (Admin console).</p>
      </aside>
      <IntegrationNotice
        state={live ? 'connected' : 'mock'}
        title={live ? 'Live queues hydrating' : 'Demo queues'}
        description='TC and escalations pull from FastAPI when live; other tiles deep-link to existing Director approval workspaces.'
      />
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        {QUEUES.map((q) => {
          let count = '—'
          if (q.id === 'tc' && tcPending != null) count = String(tcPending)
          if (q.id === 'escalations' && escPending != null) count = String(escPending)
          return (
            <Surface key={q.id} className='flex flex-col gap-3 p-4'>
              <div className='flex items-start justify-between gap-2'>
                <h2 className='text-base font-semibold text-slate-900'>{q.title}</h2>
                <span className='rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white'>{count}</span>
              </div>
              <p className='text-xs text-slate-500'>{q.client}</p>
              <Link to={q.href} className='mt-auto text-sm font-semibold text-[var(--erp-indigo)] hover:underline'>
                Open queue →
              </Link>
            </Surface>
          )
        })}
      </div>
    </section>
  )
}
