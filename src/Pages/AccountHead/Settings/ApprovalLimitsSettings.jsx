import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { PageHeader, Surface, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
  DEFAULT_APPROVAL_LIMITS,
  fetchApprovalLimitsApi,
  saveApprovalLimitsApi,
  loadApprovalLimits,
} from '../../../Common/Finance/approvalLimits'

/**
 * Client Finance rule: Finance Head configures per-role approval limits (PostgreSQL).
 * Finance Assistant may view; only Head can save (backend finance.write).
 */
export default function ApprovalLimitsSettings() {
  const live = isLiveApiEnabled()
  const [limits, setLimits] = useState(() => loadApprovalLimits())
  const [loading, setLoading] = useState(live)
  const [saving, setSaving] = useState(false)
  const [readOnly, setReadOnly] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const res = await fetchApprovalLimitsApi()
      if (cancelled) return
      setLoading(false)
      if (res.success && Array.isArray(res.data) && res.data.length) {
        setLimits(res.data)
      } else if (!live) {
        setLimits(loadApprovalLimits().length ? loadApprovalLimits() : [...DEFAULT_APPROVAL_LIMITS])
      }
      try {
        const raw = localStorage.getItem('qmis-auth-user') || sessionStorage.getItem('qmis-auth-user')
        const user = raw ? JSON.parse(raw) : null
        const perms = user?.permissions || []
        const role = String(user?.role || '').toLowerCase()
        if (live && role.includes('assistant')) setReadOnly(true)
        if (live && Array.isArray(perms) && perms.length && !perms.includes('finance.write')) {
          setReadOnly(true)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => { cancelled = true }
  }, [live])

  const updateLimit = (role, value) => {
    if (readOnly) return
    setLimits((prev) => prev.map((row) => (
      row.role === role ? { ...row, limitInr: Number(value) || 0 } : row
    )))
  }

  const handleSave = async () => {
    if (readOnly) {
      toast.error('Only Finance Head can change approval limits.')
      return
    }
    setSaving(true)
    const res = await saveApprovalLimitsApi(limits)
    setSaving(false)
    if (!res.success) {
      toast.error(typeof res.error === 'string' ? res.error : 'Could not save approval limits.')
      return
    }
    if (Array.isArray(res.data) && res.data.length) setLimits(res.data)
    toast.success(
      live
        ? 'Approval limits saved to PostgreSQL. Purchase and material approvals enforce these caps.'
        : 'Approval limits saved locally (demo mode).',
    )
  }

  return (
    <section className='space-y-5'>
      <PageHeader
        title='Approval limits'
        description='Finance Head sets per-role spend/approval limits. Amounts above the limit escalate to Finance.'
      />
      <IntegrationNotice
        state={live ? 'connected' : 'mock'}
        title={live ? 'Live PostgreSQL limits' : 'Browser demo limits'}
        description={
          live
            ? 'Limits persist in finance_approval_limits and gate purchase / material approval APIs.'
            : 'Enable the live API to load and save campus limits from PostgreSQL.'
        }
      />
      {readOnly && (
        <p className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
          Finance Assistant view — limits are read-only. Ask Finance Head to change caps.
        </p>
      )}
      <Surface className='overflow-x-auto p-0'>
        {loading ? (
          <p className='p-6 text-sm text-slate-500'>Loading limits…</p>
        ) : (
          <table className='w-full text-sm'>
            <thead className='bg-slate-50 text-xs uppercase text-slate-600'>
              <tr>
                <th className='px-4 py-3 text-left'>Role</th>
                <th className='px-4 py-3 text-left'>Limit (₹)</th>
              </tr>
            </thead>
            <tbody>
              {limits.map((row) => (
                <tr key={`${row.role}-${row.category || 'general'}`} className='border-t border-slate-100'>
                  <td className='px-4 py-3 font-medium'>{row.label}</td>
                  <td className='px-4 py-3'>
                    <input
                      type='number'
                      min={0}
                      disabled={readOnly}
                      value={row.limitInr}
                      onChange={(e) => updateLimit(row.role, e.target.value)}
                      className='w-40 rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50'
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Surface>
      <button
        type='button'
        disabled={saving || readOnly}
        onClick={handleSave}
        className='rounded-xl bg-[var(--erp-indigo)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
      >
        {saving ? 'Saving…' : 'Save approval limits'}
      </button>
    </section>
  )
}
