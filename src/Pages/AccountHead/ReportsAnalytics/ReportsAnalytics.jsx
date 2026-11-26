import React, { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { IntegrationNotice, PageHeader } from '../../../Common/ui'
import LiveStatusBanner from '../financeDomain/LiveStatusBanner'
import { getReportPackApi } from '../../../services/api/financeExtrasApiService.js'
import { isLiveApiEnabled } from '../../../services/api/tokenStore.js'
import FinancialOverviewTab from './Components/FinancialOverviewTab'
import IncomeReportsTab from './Components/IncomeReportsTab'
import ExpenditureReportsTab from './Components/ExpenditureReportsTab'
import FeeComparisonTab from './Components/FeeComparisonTab'
import TrendsPatternsTab from './Components/TrendsPatternsTab'
import { REPORTS_TABS } from './reportsAnalyticsData'

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

function packToCsv(pack) {
    const lines = [['Section', 'Item', 'Amount (INR)', 'Share %']]
    lines.push(['Overview', 'Total income', pack.overview.totalIncome, ''])
    lines.push(['Overview', 'Total expenditure', pack.overview.totalExpense, ''])
    lines.push(['Overview', 'Net surplus', pack.overview.netSurplus, ''])
    lines.push(['Overview', 'Fee collection efficiency %', pack.overview.collectionEfficiency, ''])
    pack.overview.trend.labels.forEach((month, index) => {
        lines.push(['Monthly income', month, pack.overview.trend.income[index], ''])
        lines.push(['Monthly expenditure', month, pack.overview.trend.expenditure[index], ''])
    })
    pack.income.breakdown.forEach((row) => lines.push(['Income', row.category, row.amountValue, row.percentValue]))
    pack.expenditure.breakdown.forEach((row) => lines.push(['Expenditure', row.category, row.amountValue, row.percentValue]))
    ;['current', 'previous'].forEach((key) => {
        const stats = pack.feeComparison[key]
        ;['totalDemand', 'totalConcession', 'netDemand', 'collected', 'outstanding', 'fineCollected', 'defaulters'].forEach((field) => {
            lines.push([`Fees ${stats.academicYear}`, field, stats[field], ''])
        })
    })
    return lines.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

const ReportsAnalytics = () => {
    const live = isLiveApiEnabled()
    const [activeTab, setActiveTab] = useState('financial-overview')
    const [pack, setPack] = useState(null)
    const [year, setYear] = useState('')
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')

    const refresh = useCallback(async (financialYear) => {
        if (!live) return
        setLoading(true)
        const res = await getReportPackApi(financialYear)
        setLoading(false)
        if (!res.success) {
            setError(res.error)
            return
        }
        setError('')
        setPack(res.data)
        setYear(res.data.financialYear)
    }, [live])

    useEffect(() => {
        refresh()
    }, [refresh])

    const exportCsv = () => {
        if (!pack) return
        const blob = new Blob([packToCsv(pack)], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `finance-report-FY-${pack.financialYear}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    const yearOptions = pack ? [pack.financialYear, pack.previousFinancialYear] : []
    const tabPack = live ? pack : null

    if (live && !pack) {
        return (
            <section className='space-y-5'>
                <PageHeader title='Reports & analytics' description='Finance reports generated from posted ledger entries and fee installments.' />
                <LiveStatusBanner loading={loading} error={error} onRetry={() => refresh(year || undefined)} />
            </section>
        )
    }

    return (
        <section className='space-y-5'>
            <PageHeader
                title='Reports & analytics'
                description={live ? 'Finance reports generated from posted ledger entries and fee installments.' : 'Review finance report designs while the reporting and export APIs are being implemented.'}
                context={live ? `FY ${pack.financialYear} (April–March) · generated ${new Date(pack.generatedAt).toLocaleString()}` : 'Academic year 2025–26 · reference dataset · all modules'}
                actions={live ? (
                    <div className='flex items-center gap-2'>
                        <select aria-label='Financial year' value={year} onChange={(e) => refresh(e.target.value)} className='min-h-10 rounded-lg border border-[var(--erp-line-strong)] bg-white px-3 text-sm'>
                            {yearOptions.map((y) => <option key={y} value={y}>FY {y}</option>)}
                        </select>
                        <button type='button' onClick={() => refresh(year)} disabled={loading} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-4 text-sm font-semibold cursor-pointer disabled:opacity-60'>
                            <RefreshCw aria-hidden='true' size={16} /> Refresh
                        </button>
                        <button type='button' onClick={exportCsv} className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--erp-indigo)] px-4 text-sm font-semibold text-white cursor-pointer'>
                            <Download aria-hidden='true' size={16} /> Export CSV
                        </button>
                    </div>
                ) : (
                    <button type='button' disabled title='Export requires the connected finance reporting API.' className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--erp-line-strong)] bg-white px-4 text-sm font-semibold text-[var(--erp-muted)] opacity-60'>
                        <Download aria-hidden='true' size={16} /> Export unavailable
                    </button>
                )}
            />

            {live ? (
                <IntegrationNotice
                    state='connected'
                    title='Live finance reports (PostgreSQL)'
                    description={`${pack.source}. Income and expense come from posted ledger lines; fee comparison comes from installments. PDF export is not available yet.`}
                />
            ) : (
                <IntegrationNotice
                    state='demo'
                    title='Sample analytics dataset'
                    description='Charts and comparisons on this page are labelled design fixtures. They are not generated from posted ledger entries, reconciliation or a reporting warehouse.'
                />
            )}
            {live ? <LiveStatusBanner loading={loading} error={error} onRetry={() => refresh(year)} /> : null}

            <div className='rounded-[var(--erp-radius-surface)] border border-[var(--erp-line)] bg-white px-4 pt-3 sm:px-5'>
                <div className='flex gap-3 overflow-x-auto border-b border-[var(--erp-line)]' role='tablist' aria-label='Finance analytics views'>
                    {REPORTS_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type='button'
                            role='tab'
                            aria-selected={activeTab === tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`min-h-11 whitespace-nowrap border-b-2 px-3 text-sm font-semibold ${
                                activeTab === tab.id
                                    ? 'border-[var(--erp-indigo)] text-[var(--erp-indigo)]'
                                    : 'border-transparent text-[var(--erp-slate)]'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'financial-overview' && <FinancialOverviewTab pack={tabPack} />}
            {activeTab === 'income-reports' && <IncomeReportsTab pack={tabPack} />}
            {activeTab === 'expenditure-reports' && <ExpenditureReportsTab pack={tabPack} />}
            {activeTab === 'fee-comparison' && <FeeComparisonTab pack={tabPack} />}
            {activeTab === 'trends-patterns' && <TrendsPatternsTab pack={tabPack} />}

        </section>
    )
}

export default ReportsAnalytics
