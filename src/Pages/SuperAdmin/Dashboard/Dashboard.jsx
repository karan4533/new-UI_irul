import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import {
    Activity,
    ArrowRight,
    ArrowUpRight,
    BookOpen,
    Building2,
    Bus,
    CheckCircle2,
    ChevronRight,
    ClipboardCheck,
    GraduationCap,
    IndianRupee,
    Landmark,
    Package,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Trophy,
    UserCheck,
    UserPlus,
    Users,
    Wrench,
} from 'lucide-react'
import {
    ACTIVE_FINDINGS,
    APPROVAL_PRIORITY_COLORS,
    CHART_COLORS,
    DEPARTMENT_STATUS_COLORS,
    DEPARTMENT_SUMMARIES,
    EXECUTIVE_SUMMARY,
    FINDINGS_BY_SEVERITY,
    GOVERNANCE_TREND,
    INCOME_MIX,
    INVENTORY_ALERTS,
    MODULE_HEALTH,
    MODULE_STATUS_COLORS,
    PROGRESS_METRICS,
    RECENT_APPROVALS,
    findingSeverityBadgeColor,
} from './dashboardData'
import { FeedbackState, RatingBadge } from '../../../Common/ui'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { getAdminDashboard } from '../../../services/api/adminDashboardApiService'

const OPERATIONAL_DEPARTMENTS = [
    {
        key: 'academics',
        title: 'Academics & Faculty',
        icon: BookOpen,
        color: 'text-blue-600 bg-blue-50 border-blue-200',
        route: '/super-admin/attendance/students/list',
        primaryMetric: '1,240 Enrolled Students',
        subMetric: '96% Operational Index',
        badge: 'Operational',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        details: 'Grades 1-12 active · Term sessions synchronized · 98% faculty attendance',
    },
    {
        key: 'facilities',
        title: 'Facilities & Campus Tasks',
        icon: Wrench,
        color: 'text-amber-600 bg-amber-50 border-amber-200',
        route: '/super-admin/tasks',
        primaryMetric: '24 Spares & Equipment',
        subMetric: '91% Facility Readiness',
        badge: 'Operational',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        details: 'Housekeeping roster active · Preventative maintenance on schedule · 0 HVAC alerts',
    },
    {
        key: 'transport',
        title: 'Transport Logistics',
        icon: Bus,
        color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
        route: '/super-admin/transport-overview',
        primaryMetric: '5 Fleet Vehicles',
        subMetric: '8 Daily Transit Routes',
        badge: 'Operational',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        details: '95% Document validity · 100% trip coverage · Valid fitness certifications',
    },
    {
        key: 'hr',
        title: 'Human Resources (HR)',
        icon: Users,
        color: 'text-purple-600 bg-purple-50 border-purple-200',
        route: '/super-admin/user-database/employees',
        primaryMetric: '248 Employees',
        subMetric: '92% Average Attendance',
        badge: 'Operational',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        details: '2 Joiners in onboarding · 1 Pending leave · 0 Grievance escalations',
    },
    {
        key: 'finance',
        title: 'Finance & Accounts',
        icon: Landmark,
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        route: '/super-admin/finance/overview',
        primaryMetric: EXECUTIVE_SUMMARY.netSurplus,
        subMetric: `${EXECUTIVE_SUMMARY.feeCollectionRate}% Collection Rate`,
        badge: 'Balanced',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        details: `Pending dues ${EXECUTIVE_SUMMARY.pendingFees} · Day book reconciled · Ledger locked`,
    },
    {
        key: 'audit',
        title: 'Audit & Governance',
        icon: ShieldAlert,
        color: 'text-rose-600 bg-rose-50 border-rose-200',
        route: '/super-admin/audit-reports/overview',
        primaryMetric: '88% Compliance Score',
        subMetric: '5 Active Findings',
        badge: 'Monitoring',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        details: '8 Operational units audited · 0 High-risk exceptions · Annual review in progress',
    },
    {
        key: 'security',
        title: 'Perimeter & Security',
        icon: ShieldCheck,
        color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
        route: '/super-admin/gate-pass',
        primaryMetric: '100% Gate Clearance',
        subMetric: '0 Open Incidents',
        badge: 'Operational',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        details: 'Visitor logs synchronized · Inward/outward material passes verified',
    },
]

const QUICK_NAV_LINKS = [
    { label: 'Student Database', path: '/super-admin/user-database/students', icon: GraduationCap, count: '1,240' },
    { label: 'Employee Database', path: '/super-admin/user-database/employees', icon: Users, count: '248' },
    { label: 'Admin User Creation', path: '/super-admin/user-creation', icon: UserPlus, count: 'Manage' },
    { label: 'Governance Approvals', path: '/super-admin/approvals', icon: ClipboardCheck, count: '10 Pending' },
    { label: 'Star Recognition Awards', path: '/super-admin/star-ratings/star-of-month', icon: Trophy, count: 'SOM/SOY' },
    { label: 'System Activity Logs', path: '/super-admin/activity-logs/login-history', icon: Activity, count: 'Audit' },
]

const ProgressBar = ({ label, value, target, color }) => (
    <div>
        <div className='flex items-center justify-between gap-2 mb-1.5'>
            <span className='text-xs font-semibold text-slate-800'>{label}</span>
            <span className='text-xs font-bold' style={{ color }}>{value}%</span>
        </div>
        <div className='h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200'>
            <div
                className='h-full rounded-full transition-all duration-500'
                style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
            />
        </div>
        <p className='text-[10px] text-slate-400 mt-1'>Target: {target}%</p>
    </div>
)

const Panel = ({ title, action, children, className = '' }) => (
    <div className={`bg-white rounded-2xl shadow-xs border border-slate-200 p-5 ${className}`}>
        <div className='flex items-center justify-between mb-4'>
            <h3 className='text-sm font-bold text-slate-900'>{title}</h3>
            {action}
        </div>
        {children}
    </div>
)

const Dashboard = () => {
    const navigate = useNavigate()
    const live = isLiveApiEnabled()
    const [liveKpis, setLiveKpis] = useState(null)
    const [kpiLoading, setKpiLoading] = useState(Boolean(live))
    const [kpiError, setKpiError] = useState('')

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setKpiLoading(false)
            return
        }
        let cancelled = false
        ;(async () => {
            setKpiLoading(true)
            setKpiError('')
            const res = await getAdminDashboard()
            if (cancelled) return
            setKpiLoading(false)
            if (!res.success) {
                setKpiError(typeof res.error === 'string' ? res.error : 'Dashboard API unavailable.')
                setLiveKpis(null)
                return
            }
            setLiveKpis(res.data)
        })()
        return () => { cancelled = true }
    }, [])

    const onFinancialTrendClick = (params) => {
        if (params?.name) {
            navigate(`/super-admin/finance/overview?period=${encodeURIComponent(params.name)}`)
        } else {
            navigate('/super-admin/finance/overview')
        }
    }

    const onIncomeMixClick = (params) => {
        if (params?.name) {
            navigate(`/super-admin/finance/accounts?stream=${encodeURIComponent(params.name)}`)
        } else {
            navigate('/super-admin/finance/accounts')
        }
    }

    const onFindingsSeverityClick = (params) => {
        if (params?.name) {
            navigate(`/super-admin/audit-reports/overview?severity=${encodeURIComponent(params.name)}`)
        } else {
            navigate('/super-admin/audit-reports/overview')
        }
    }
    const financialTrendOption = useMemo(() => ({
        tooltip: { trigger: 'axis' },
        legend: {
            data: ['Revenue', 'Expenses', 'Compliance'],
            bottom: 0,
            textStyle: { color: '#667085', fontSize: 11 },
        },
        grid: { left: 42, right: 36, top: 20, bottom: 42 },
        xAxis: {
            type: 'category',
            data: GOVERNANCE_TREND.labels,
            axisLabel: { color: '#667085', fontSize: 10 },
            axisLine: { lineStyle: { color: '#E0E0E0' } },
        },
        yAxis: [
            {
                type: 'value',
                name: '₹ Lakhs',
                axisLabel: { color: '#667085', fontSize: 10 },
                splitLine: { lineStyle: { color: '#F2F4F7' } },
            },
            {
                type: 'value',
                name: 'Compliance %',
                min: 75,
                max: 100,
                axisLabel: { color: '#667085', fontSize: 10, formatter: '{value}%' },
                splitLine: { show: false },
            },
        ],
        series: [
            {
                name: 'Revenue',
                type: 'bar',
                data: GOVERNANCE_TREND.revenue,
                barWidth: 16,
                itemStyle: { color: '#515DEF', borderRadius: [4, 4, 0, 0] },
            },
            {
                name: 'Expenses',
                type: 'bar',
                data: GOVERNANCE_TREND.expenses,
                barWidth: 16,
                itemStyle: { color: '#94A3B8', borderRadius: [4, 4, 0, 0] },
            },
            {
                name: 'Compliance',
                type: 'line',
                yAxisIndex: 1,
                smooth: true,
                data: GOVERNANCE_TREND.compliance,
                lineStyle: { color: '#3B82F6', width: 2.5 },
                itemStyle: { color: '#3B82F6' },
                symbol: 'circle',
                symbolSize: 6,
            },
        ],
    }), [])

    const incomeMixOption = useMemo(() => ({
        tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
        series: [{
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['50%', '50%'],
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
            label: { show: false },
            data: INCOME_MIX.map((item) => ({
                name: item.name,
                value: item.percent,
                itemStyle: { color: item.color },
            })),
        }],
    }), [])

    const findingsSeverityOption = useMemo(() => ({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 40, right: 16, top: 16, bottom: 28 },
        xAxis: {
            type: 'category',
            data: FINDINGS_BY_SEVERITY.map((item) => item.name),
            axisLabel: { color: '#667085', fontSize: 10 },
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: '#667085', fontSize: 10 },
            splitLine: { lineStyle: { color: '#F2F4F7' } },
        },
        series: [{
            type: 'bar',
            data: FINDINGS_BY_SEVERITY.map((item, index) => ({
                value: item.value,
                itemStyle: {
                    color: [CHART_COLORS.danger, CHART_COLORS.warning, CHART_COLORS.info, CHART_COLORS.palette[5]][index],
                    borderRadius: [4, 4, 0, 0],
                },
            })),
            barWidth: 28,
        }],
    }), [])

    return (
        <section className='space-y-6 max-w-7xl mx-auto pb-10'>
            {/* Clean ERP Executive Header */}
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5'>
                <div>
                    <div className='flex items-center gap-2.5'>
                        <h1 className='text-2xl font-bold tracking-tight text-slate-900'>
                            Super Admin Executive Dashboard
                        </h1>
                        <span className='px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold'>
                            Enterprise Governance
                        </span>
                    </div>
                    <p className='mt-1 text-xs text-slate-500'>
                        Comprehensive operational visibility across departments, identity access, financial status, and audit compliance.
                    </p>
                </div>

                <div className='flex items-center gap-2 flex-wrap'>
                    <Link
                        to='/super-admin/approvals'
                        className='px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors inline-flex items-center gap-1.5'
                    >
                        <ClipboardCheck size={14} />
                        <span>Pending Approvals ({RECENT_APPROVALS.length})</span>
                    </Link>
                    <Link
                        to='/super-admin/user-creation'
                        className='px-4 py-2 text-xs font-bold rounded-xl bg-[var(--erp-indigo)] text-white hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 shadow-xs'
                    >
                        <UserPlus size={14} />
                        <span>Manage Admin Users</span>
                    </Link>
                </div>
            </div>

            {live ? (
                <div className='rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4'>
                    <p className='text-xs font-semibold uppercase tracking-wide text-emerald-800 mb-3'>
                        Live campus KPIs · GET /api/v1/admin/dashboard{liveKpis?.asOf ? ` · as of ${liveKpis.asOf}` : ''}
                    </p>
                    {kpiLoading ? (
                        <FeedbackState kind='loading' title='Loading dashboard KPIs' description='Fetching from the admin dashboard API…' />
                    ) : kpiError ? (
                        <FeedbackState kind='error' title='Dashboard API unavailable' description={kpiError} />
                    ) : liveKpis ? (
                        <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3'>
                            {[
                                ['Students', liveKpis.students],
                                ['Employees', liveKpis.employees],
                                ['Leave requests', liveKpis.leaveRequests],
                                ['Open escalations', liveKpis.openEscalations],
                                ['Pending TC', liveKpis.pendingTc],
                                ['Unread notifications', liveKpis.unreadNotifications],
                                ['Announcements (month)', liveKpis.announcementsThisMonth],
                            ].map(([label, value]) => (
                                <article key={label} className='rounded-xl border border-emerald-100 bg-white p-3'>
                                    <p className='text-[10px] font-medium uppercase tracking-wide text-slate-500'>{label}</p>
                                    <p className='mt-1 text-xl font-bold text-slate-900'>{value}</p>
                                </article>
                            ))}
                        </div>
                    ) : null}
                    <p className='mt-3 text-[11px] text-slate-500'>Charts below remain demo visuals until those modules are integrated for this role.</p>
                </div>
            ) : null}

            {/* Direct Role/User Management Quick Links Bar */}
            <div>
                <h2 className='text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5'>
                    Direct Role & User Management Navigation
                </h2>
                <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3'>
                    {QUICK_NAV_LINKS.map((link) => {
                        const Icon = link.icon
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                className='p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between group'
                            >
                                <div className='flex items-center justify-between'>
                                    <div className='size-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors'>
                                        <Icon size={16} />
                                    </div>
                                    <span className='text-[11px] font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform'>
                                        {link.count}
                                    </span>
                                </div>
                                <span className='text-xs font-semibold text-slate-800 mt-2 block truncate'>
                                    {link.label}
                                </span>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* Focused 4 Executive Governance KPI Cards */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                <Link
                    to='/super-admin/finance/overview'
                    className='bg-white rounded-2xl border border-slate-200 p-4 shadow-xs border-l-4 border-l-indigo-600 hover:border-indigo-400 hover:shadow-md transition-all group'
                >
                    <div className='flex items-center justify-between'>
                        <span className='text-xs font-semibold uppercase tracking-wider text-slate-400 block'>Net Operating Surplus</span>
                        <ArrowUpRight size={14} className='text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform' />
                    </div>
                    <p className='text-2xl font-bold text-slate-900 mt-1'>{EXECUTIVE_SUMMARY.netSurplus}</p>
                    <span className='text-xs text-emerald-600 font-semibold inline-flex items-center gap-0.5 mt-1'>
                        <ArrowUpRight size={13} /> Reconciled & Audited
                    </span>
                </Link>

                <Link
                    to='/super-admin/finance/accounts'
                    className='bg-white rounded-2xl border border-slate-200 p-4 shadow-xs border-l-4 border-l-emerald-600 hover:border-emerald-400 hover:shadow-md transition-all group'
                >
                    <div className='flex items-center justify-between'>
                        <span className='text-xs font-semibold uppercase tracking-wider text-slate-400 block'>Fee Collection Rate</span>
                        <ArrowUpRight size={14} className='text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform' />
                    </div>
                    <p className='text-2xl font-bold text-slate-900 mt-1'>{EXECUTIVE_SUMMARY.feeCollectionRate}%</p>
                    <span className='text-xs text-slate-500 font-medium block mt-1'>
                        Pending dues: {EXECUTIVE_SUMMARY.pendingFees}
                    </span>
                </Link>

                <Link
                    to='/super-admin/audit-reports/overview'
                    className='bg-white rounded-2xl border border-slate-200 p-4 shadow-xs border-l-4 border-l-blue-600 hover:border-blue-400 hover:shadow-md transition-all group'
                >
                    <div className='flex items-center justify-between'>
                        <span className='text-xs font-semibold uppercase tracking-wider text-slate-400 block'>Institutional Compliance</span>
                        <ArrowUpRight size={14} className='text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform' />
                    </div>
                    <p className='text-2xl font-bold text-slate-900 mt-1'>88%</p>
                    <span className='text-xs text-blue-600 font-semibold inline-flex items-center gap-0.5 mt-1'>
                        <ShieldCheck size={13} /> Grade A Regulatory Rating
                    </span>
                </Link>

                <Link
                    to='/super-admin/approvals'
                    className='bg-white rounded-2xl border border-slate-200 p-4 shadow-xs border-l-4 border-l-amber-500 hover:border-amber-400 hover:shadow-md transition-all group'
                >
                    <div className='flex items-center justify-between'>
                        <span className='text-xs font-semibold uppercase tracking-wider text-slate-400 block'>Pending Decisions</span>
                        <ArrowUpRight size={14} className='text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform' />
                    </div>
                    <p className='text-2xl font-bold text-slate-900 mt-1'>{RECENT_APPROVALS.length}</p>
                    <span className='text-xs text-amber-600 font-medium block mt-1'>
                        Awaiting Super Admin sanction
                    </span>
                </Link>
            </div>

            {/* Operational Department Overview Cards */}
            <div>
                <div className='flex items-center justify-between mb-3'>
                    <h2 className='text-base font-bold text-slate-900'>
                        Operational Department Overviews
                    </h2>
                    <span className='text-xs text-slate-500'>
                        Real-time status across 7 functional campus divisions
                    </span>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                    {OPERATIONAL_DEPARTMENTS.map((dept) => {
                        const Icon = dept.icon
                        return (
                            <Link
                                key={dept.key}
                                to={dept.route}
                                className='bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between group'
                            >
                                <div>
                                    <div className='flex items-start justify-between gap-2 mb-3'>
                                        <div className='flex items-center gap-2.5 min-w-0'>
                                            <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 border ${dept.color}`}>
                                                <Icon size={18} />
                                            </div>
                                            <div className='min-w-0'>
                                                <h3 className='text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors'>
                                                    {dept.title}
                                                </h3>
                                                <span className='text-[11px] text-slate-400'>{dept.subMetric}</span>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${dept.badgeColor}`}>
                                            {dept.badge}
                                        </span>
                                    </div>

                                    <p className='text-sm font-extrabold text-slate-800 mb-1'>
                                        {dept.primaryMetric}
                                    </p>
                                    <p className='text-xs text-slate-500 line-clamp-2 leading-relaxed'>
                                        {dept.details}
                                    </p>
                                </div>

                                <div className='mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600 group-hover:text-indigo-700'>
                                    <span>Access Workspace</span>
                                    <ChevronRight size={14} className='group-hover:translate-x-1 transition-transform' />
                                </div>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* Governance Charts & Target Metrics */}
            <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
                <Panel
                    title='Budgeted vs Actuals & Compliance Trend'
                    action={<span className='text-xs text-slate-400'>Click chart to drill down</span>}
                    className='xl:col-span-2'
                >
                    <ReactECharts
                        option={financialTrendOption}
                        style={{ height: 310, cursor: 'pointer' }}
                        opts={{ renderer: 'svg' }}
                        onEvents={{ click: onFinancialTrendClick }}
                    />
                </Panel>
                <Panel
                    title='Performance & Compliance Targets'
                    action={<span className='text-xs text-slate-400'>Annual targets</span>}
                >
                    <div className='space-y-4 pt-1'>
                        {PROGRESS_METRICS.map((metric) => (
                            <ProgressBar key={metric.label} {...metric} />
                        ))}
                    </div>
                </Panel>
            </div>

            {/* Revenue Breakdown, Audit Severity & Approvals Queue */}
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                <Panel title='Revenue Stream Allocation' action={<span className='text-xs text-slate-400'>Click slice to view</span>}>
                    <ReactECharts
                        option={incomeMixOption}
                        style={{ height: 240, cursor: 'pointer' }}
                        opts={{ renderer: 'svg' }}
                        onEvents={{ click: onIncomeMixClick }}
                    />
                    <div className='grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100'>
                        {INCOME_MIX.map((item) => (
                            <button
                                key={item.name}
                                onClick={() => onIncomeMixClick({ name: item.name })}
                                className='flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-600 transition-colors text-left'
                            >
                                <span className='size-2 rounded-full shrink-0' style={{ backgroundColor: item.color }} />
                                <span className='truncate'>{item.name} ({item.percent}%)</span>
                            </button>
                        ))}
                    </div>
                </Panel>

                <Panel title='Active Findings by Severity' action={<span className='text-xs text-slate-400'>Click bar to view</span>}>
                    <ReactECharts
                        option={findingsSeverityOption}
                        style={{ height: 260, cursor: 'pointer' }}
                        opts={{ renderer: 'svg' }}
                        onEvents={{ click: onFindingsSeverityClick }}
                    />
                </Panel>

                <Panel
                    title='Pending Approvals Queue'
                    action={
                        <Link to='/super-admin/approvals' className='text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5'>
                            <span>View All</span>
                            <ArrowRight size={12} />
                        </Link>
                    }
                >
                    <div className='space-y-2.5 max-h-[300px] overflow-y-auto pr-1'>
                        {RECENT_APPROVALS.map((item) => (
                            <Link
                                key={item.id}
                                to={`/super-admin/approvals/view/${item.id}`}
                                className='p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-colors block text-xs'
                            >
                                <div className='flex items-center justify-between gap-1 mb-1'>
                                    <span className='font-bold text-slate-800 truncate'>{item.title}</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${APPROVAL_PRIORITY_COLORS[item.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                                        {item.priority}
                                    </span>
                                </div>
                                <span className='text-[11px] text-slate-500'>{item.department} · {item.category}</span>
                            </Link>
                        ))}
                    </div>
                </Panel>
            </div>

            {/* Department Health & Critical Alerts */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                <Panel
                    title='Module Operational Health'
                    action={<Link to='/super-admin/module-health' className='text-xs font-semibold text-indigo-600 hover:underline'>Health Report</Link>}
                >
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                        {MODULE_HEALTH.map((item) => (
                            <div key={item.module} className='p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between'>
                                <div>
                                    <p className='text-xs font-bold text-slate-800'>{item.module}</p>
                                    <div className='flex items-center gap-2 mt-1'>
                                        <div className='w-20 h-1.5 rounded-full bg-slate-200 overflow-hidden'>
                                            <div className='h-full rounded-full bg-indigo-600' style={{ width: `${item.score}%` }} />
                                        </div>
                                        <span className='text-[10px] font-bold text-indigo-600'>{item.score}%</span>
                                    </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${MODULE_STATUS_COLORS[item.status]}`}>
                                    {item.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel
                    title='Critical Inventory Watchlist'
                    action={<Link to='/super-admin/tasks' className='text-xs font-semibold text-indigo-600 hover:underline'>Stores</Link>}
                >
                    <div className='space-y-2 max-h-[220px] overflow-y-auto pr-1'>
                        {INVENTORY_ALERTS.map((row) => (
                            <div key={`${row.department}-${row.item}`} className='p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs'>
                                <div className='min-w-0 pr-2'>
                                    <span className='font-bold text-slate-800 block truncate'>{row.item}</span>
                                    <span className='text-[10px] text-slate-400'>{row.department} · {row.alertType}</span>
                                </div>
                                <span className='px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0'>
                                    {row.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>
        </section>
    )
}

export default Dashboard
