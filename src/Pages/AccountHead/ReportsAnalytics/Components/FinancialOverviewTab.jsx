import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import {
    INCOME_EXPENDITURE_TREND,
    REVENUE_BREAKDOWN,
    OVERVIEW_SUMMARY,
} from '../reportsAnalyticsData'
import { Panel, SummaryCards } from './ReportsShared'

const BREAKDOWN_COLORS = ['#515DEF', '#2196F3', '#B4C4FF', '#D9D5C8', '#8E9BFF', '#64748B']
const toLakhs = (values) => values.map((v) => Math.round((Number(v) / 100000) * 100) / 100)

const FinancialOverviewTab = ({ pack }) => {
    const summary = pack ? pack.overview.cards : OVERVIEW_SUMMARY
    const trend = useMemo(() => (pack
        ? { labels: pack.overview.trend.labels, income: toLakhs(pack.overview.trend.income), expenditure: toLakhs(pack.overview.trend.expenditure) }
        : INCOME_EXPENDITURE_TREND), [pack])
    const breakdown = useMemo(() => (pack
        ? pack.overview.revenueBreakdown.map((item, index) => ({ ...item, color: BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length] }))
        : REVENUE_BREAKDOWN), [pack])

    const incomeExpenditureOption = useMemo(() => ({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: {
            data: ['Income', 'Expenditure'],
            bottom: 0,
            textStyle: { color: '#667085', fontSize: 11 },
        },
        grid: { left: 40, right: 16, top: 16, bottom: 48 },
        xAxis: {
            type: 'category',
            data: trend.labels,
            axisLine: { lineStyle: { color: '#E0E0E0' } },
            axisLabel: { color: '#667085', fontSize: 11 },
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: '#667085', fontSize: 11, formatter: (v) => `₹${v}L` },
            splitLine: { lineStyle: { color: '#F2F4F7' } },
        },
        series: [
            {
                name: 'Income',
                type: 'bar',
                stack: 'total',
                barWidth: 28,
                data: trend.income,
                itemStyle: { color: '#515DEF', borderRadius: [4, 4, 0, 0] },
            },
            {
                name: 'Expenditure',
                type: 'bar',
                stack: 'total',
                data: trend.expenditure,
                itemStyle: { color: '#64748B', borderRadius: [0, 0, 4, 4] },
            },
        ],
    }), [trend])

    const incomeMixOption = useMemo(() => ({
        tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
        series: [{
            type: 'pie',
            radius: ['58%', '78%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: true,
            label: { show: false },
            labelLine: { show: false },
            data: breakdown.map((item) => ({
                value: item.percent,
                name: item.name,
                itemStyle: { color: item.color },
            })),
        }],
    }), [breakdown])

    return (
        <div className='space-y-6'>
            <SummaryCards cards={summary} />

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                <Panel title='Income vs expenditure — by month'>
                    <ReactECharts option={incomeExpenditureOption} style={{ height: 260 }} opts={{ renderer: 'svg' }} />
                </Panel>

                <Panel title='Revenue Breakdown'>
                    <div className='flex items-center gap-6'>
                        <div className='flex-1 min-w-0'>
                            <ReactECharts option={incomeMixOption} style={{ height: 220 }} opts={{ renderer: 'svg' }} />
                        </div>
                        <div className='space-y-3 shrink-0'>
                            {breakdown.length === 0 ? <p className='text-sm text-[#667085]'>No income posted in this financial year.</p> : null}
                            {breakdown.map((item) => (
                                <div key={item.name} className='flex items-center gap-2 text-sm'>
                                    <span className='size-2.5 rounded-sm shrink-0' style={{ backgroundColor: item.color }} />
                                    <span className='text-[#667085]'>{item.name}</span>
                                    <span className='font-semibold text-[#1E1E1E]'>{item.percent}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Panel>
            </div>
        </div>
    )
}

export default FinancialOverviewTab
