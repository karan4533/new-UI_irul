import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { PageHeader, Surface, IntegrationNotice } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { getFinanceState, saveFinanceStateApi } from '../../../services/api/financeApiService'
import { loadApprovalLimits, saveApprovalLimitsLocal } from '../../../Common/Finance/approvalLimits'

/**
 * Client Finance rule: Finance sets approval limits for Academics + Non-Academics.
 * Amounts above limit escalate to Finance via department head.
 */
export default function ApprovalLimitsSettings() {
  const live = isLiveApiEnabled()
  const [limits, setLimits] = useState(() => loadApprovalLimits())
  const [loading, setLoading] = useState(live)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!live) {
      setLimits(loadApprovalLimits())
      return undefined
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const res = await getFinanceState()
      if (cancelled) return
      setLoading(false)
      const rows = res.data?.data?.approvalLimits || res.data?.approvalLimits
      if (res.success && Array.isArray(rows) && rows.length) {
        setLimits(rows.map((row) => ({
          role: row.role,
          label: row.label || row.role,
          limitInr: Number(row.limitInr ?? row.limit ?? 0),
        })))
      }
    })()
    return () => { cancelled = true }
  }, [live])

  const updateLimit = (role, value) => {
    setLimits((prev) => prev.map((row) => (
      row.role === role ? { ...row, limitInr: Number(value) || 0 } : row
    )))
  }

  const handleSave = async () => {
    saveApprovalLimitsLocal(limits)
    if (!live) {
      toast.success('Approval limits saved locally — store/purchase engines will enforce them.')
      return
    }
    setSaving(true)
    const current = await getFinanceState()
    if (!current.success) {
      setSaving(false)
      toast.error('Could not load finance state.')
      return
    }
    const data = { ...(current.data?.data || current.data || {}), approvalLimits: limits }
    const res = await saveFinanceStateApi(data)
    setSaving(false)
    if (!res.success) {
      toast.error(typeof res.error === 'string' ? res.error : 'Could not save approval limits.')
      return
    }
    toast.success('Finance approval limits saved. Store/purchase must respect these caps.')
  }

  return (
    <section className='space-y-5'>
      <PageHeader
        title='Approval limits'
        description='Client rule: Finance sets per-role spend/approval limits for Academics and Non-Academics. Above limit → Finance via head.'
      />
      <IntegrationNotice
        state={live ? 'connected' : 'mock'}
        title={live ? 'Live finance snapshot' : 'Browser demo limits'}
        description='Limits are stored on the campus finance state and should gate store issues / purchase requests.'
      />
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
                <tr key={row.role} className='border-t border-slate-100'>
                  <td className='px-4 py-3 font-medium'>{row.label}</td>
                  <td className='px-4 py-3'>
                    <input
                      type='number'
                      min={0}
                      value={row.limitInr}
                      onChange={(e) => updateLimit(row.role, e.target.value)}
                      className='w-40 rounded-lg border border-slate-200 px-3 py-2'
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
        disabled={saving}
        onClick={handleSave}
        className='rounded-xl bg-[var(--erp-indigo)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
      >
        {saving ? 'Saving…' : 'Save approval limits'}
      </button>
    </section>
  )
}
