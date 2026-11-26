import { useCallback, useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { RefreshCw } from 'lucide-react'
import { IntegrationNotice, PageHeader } from '../../../Common/ui'
import { BudgetPage } from '../../../Common/demoDomain/DemoScreens'
import { useFinance } from '../financeDomain/FinanceContext'
import LiveStatusBanner from '../financeDomain/LiveStatusBanner'
import { listBudgetApi, upsertBudgetLineApi } from '../../../services/api/financeExtrasApiService.js'
import { isLiveApiEnabled } from '../../../services/api/tokenStore.js'

const inputClass = 'text-sm border border-[#D9D9D9] rounded-md px-2 py-2 w-full'
const th = 'px-2 py-3 text-left'
const td = 'px-2 py-3'
const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`
const EMPTY_FORM = { department: '', category: '', budget: '', ledgerAccounts: '' }

function LiveAnnualBudget() {
    const { rehydrateFromApi } = useFinance()
    const [year, setYear] = useState('')
    const [data, setData] = useState(null)
    const [drafts, setDrafts] = useState({})
    const [form, setForm] = useState(EMPTY_FORM)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const refresh = useCallback(async (financialYear) => {
        setLoading(true)
        const res = await listBudgetApi(financialYear)
        setLoading(false)
        if (!res.success) {
            setError(res.error)
            return
        }
        setError('')
        setData(res.data)
        setYear(res.data.financialYear)
        setDrafts({})
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    const save = async (payload, message) => {
        setBusy(true)
        setNotice('')
        const res = await upsertBudgetLineApi({ financialYear: year, ...payload })
        setBusy(false)
        if (!res.success) {
            setError(res.error)
            return false
        }
        setError('')
        setNotice(res.data?.skipped ? 'No change — the budget already has this amount.' : message)
        await refresh(year)
        await rehydrateFromApi?.()
        return true
    }

    const submit = async (event) => {
        event.preventDefault()
        const ledgerAccounts = form.ledgerAccounts.split(',').map((x) => x.trim()).filter(Boolean)
        const ok = await save(
            { department: form.department, category: form.category, budget: form.budget === '' ? null : Number(form.budget), ledgerAccounts },
            `Budget line ${form.department} · ${form.category} saved for FY ${year}.`,
        )
        if (ok) setForm(EMPTY_FORM)
    }

    const saveRow = (row) => save(
        { department: row.department, category: row.category, budget: Number(drafts[row.id]), ledgerAccounts: row.ledgerAccounts || [] },
        `Budget for ${row.department} · ${row.category} updated.`,
    )

    const rows = data?.rows || []
    const option = {
        color: ['#515DEF', '#8E9BFF'],
        tooltip: { trigger: 'axis' },
        legend: { data: ['Budget', 'Actual'] },
        xAxis: { type: 'category', data: rows.map((row) => `${row.department} · ${row.category}`) },
        yAxis: { type: 'value' },
        series: [
            { name: 'Budget', type: 'bar', data: rows.map((row) => row.budget) },
            { name: 'Actual', type: 'bar', data: rows.map((row) => row.actual) },
        ],
    }

    return (
        <section className='space-y-4'>
            <PageHeader
                title='Annual budget vs actual'
                description='Budgets are set per department and category for an April–March financial year. Actuals are the posted ledger expense for that department, or for the listed ledger accounts.'
                actions={(
                    <div className='flex items-center gap-2'>
                        <select aria-label='Financial year' value={year} onChange={(e) => refresh(e.target.value)} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                            {(data?.years || [year]).filter(Boolean).map((y) => <option key={y} value={y}>FY {y}</option>)}
                        </select>
                        <button type='button' onClick={() => refresh(year)} disabled={loading} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-4 text-sm font-semibold cursor-pointer disabled:opacity-60'><RefreshCw aria-hidden='true' size={16} /> Refresh</button>
                    </div>
                )}
            />
            <IntegrationNotice state='connected' title='Live budget (PostgreSQL)' description='Budget amounts are saved with audit history. Actual spend is read from posted ledger entries and cannot be typed in. MFP remains awaiting specification.' />
            <LiveStatusBanner loading={loading} error={error} notice={notice} onRetry={() => refresh(year)} />

            {data?.totals ? (
                <div className='grid grid-cols-2 md:grid-cols-5 gap-3'>
                    {[
                        ['Total budget', inr(data.totals.budget)],
                        ['Actual (posted)', inr(data.totals.actual)],
                        ['Variance', inr(data.totals.variance)],
                        ['Utilisation', `${data.totals.utilization}%`],
                        ['Unbudgeted expense', inr(data.totals.unbudgetedExpense)],
                    ].map(([label, value]) => (
                        <div key={label} className='bg-white rounded-2xl shadow-md p-4'>
                            <p className='text-xs text-[#808080]'>{label}</p>
                            <p className='text-xl font-semibold'>{value}</p>
                        </div>
                    ))}
                </div>
            ) : null}

            {rows.length ? (
                <div className='bg-white rounded-2xl shadow-md p-4'>
                    <ReactECharts option={option} style={{ height: 280 }} />
                </div>
            ) : null}

            <div className='bg-white rounded-2xl shadow-md p-4 overflow-x-auto'>
                <table className='w-full text-sm'>
                    <thead className='text-xs bg-[#EDEEF5]'><tr>{['Department', 'Category', 'Actual source', 'Budget', 'Actual', 'Variance', 'Utilisation %', 'Flag', ''].map((l) => <th key={l} className={th}>{l}</th>)}</tr></thead>
                    <tbody>
                        {rows.length === 0 && !loading ? <tr><td colSpan={9} className='px-2 py-6 text-[#667085]'>No budget lines for FY {year} yet.</td></tr> : null}
                        {rows.map((row) => {
                            const draft = drafts[row.id]
                            const dirty = draft !== undefined && Number(draft) !== row.budget
                            return (
                                <tr key={row.id} className='border-b border-[#f2f4f7]'>
                                    <td className={td}>{row.department}</td>
                                    <td className={td}>{row.category}</td>
                                    <td className={td}>{row.actualSource === 'ledgerAccounts' ? (row.ledgerAccounts || []).join(', ') : 'Department ledger'}</td>
                                    <td className={td}><input type='number' min='0' aria-label={`Budget for ${row.department} ${row.category}`} value={draft ?? row.budget} onChange={(e) => setDrafts({ ...drafts, [row.id]: e.target.value })} className='w-28 border border-[#D9D9D9] rounded-md px-2 py-1' /></td>
                                    <td className={td}>{inr(row.actual)}</td>
                                    <td className={td}>{inr(row.variance)}</td>
                                    <td className={td}>{row.utilization.toFixed(1)}</td>
                                    <td className={`${td} font-medium ${row.overBudget ? 'text-[#FF5722]' : 'text-[#4CAF50]'}`}>{row.overBudget ? 'Over budget' : 'Within budget'}</td>
                                    <td className={td}>{dirty ? <button type='button' disabled={busy} onClick={() => saveRow(row)} className='text-xs font-semibold text-[#515DEF] cursor-pointer'>Save</button> : null}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <form onSubmit={submit} className='bg-white rounded-2xl shadow-md p-4 grid grid-cols-1 md:grid-cols-5 gap-3'>
                <h2 className='md:col-span-5 text-lg font-semibold'>Add budget line · FY {year}</h2>
                <label className='grid gap-1 text-sm font-medium'>Department
                    <input required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder='e.g. Transport' className={inputClass} />
                </label>
                <label className='grid gap-1 text-sm font-medium'>Category
                    <input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder='e.g. Fuel' className={inputClass} />
                </label>
                <label className='grid gap-1 text-sm font-medium'>Budget (₹)
                    <input required type='number' min='0' value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className={inputClass} />
                </label>
                <label className='grid gap-1 text-sm font-medium'>Ledger accounts (optional, comma separated)
                    <input value={form.ledgerAccounts} onChange={(e) => setForm({ ...form, ledgerAccounts: e.target.value })} placeholder='Fuel Expense, Vehicle Repairs' className={inputClass} />
                </label>
                <button disabled={busy} className='min-h-10 self-end rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white cursor-pointer disabled:opacity-60'>{busy ? 'Saving…' : 'Save budget line'}</button>
            </form>
        </section>
    )
}

export default function AnnualBudget() {
    return isLiveApiEnabled() ? <LiveAnnualBudget /> : <BudgetPage />
}
