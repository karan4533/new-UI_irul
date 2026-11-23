import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    Activity,
    ArrowUpRight,
    ClipboardCheck,
    GraduationCap,
    ShieldCheck,
    UserPlus,
    Users,
} from 'lucide-react'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { getAdminDashboard } from '../../../services/api/adminDashboardApiService'
import { listApprovalsInbox } from '../../../services/api/approvalsApiService'

const QUICK_NAV_LINKS = [
    { label: 'Student Database', path: '/super-admin/user-database/students', icon: GraduationCap, countKey: 'students', fallback: 'Open' },
    { label: 'Employee Database', path: '/super-admin/user-database/employees', icon: Users, countKey: 'employees', fallback: 'Open' },
    { label: 'Admin User Creation', path: '/super-admin/user-creation', icon: UserPlus, fallback: 'Manage' },
    { label: 'Governance Approvals', path: '/super-admin/approvals', icon: ClipboardCheck, countKey: 'pendingApprovals', fallback: 'Review' },
    { label: 'Gate Pass', path: '/super-admin/gate-pass', icon: ShieldCheck, fallback: 'Open' },
    { label: 'System Activity Logs', path: '/super-admin/activity-logs/audit-logs', icon: Activity, fallback: 'Audit' },
]

const Dashboard = () => {
    const [liveKpis, setLiveKpis] = useState(null)
    const [pendingApprovals, setPendingApprovals] = useState(null)

    useEffect(() => {
        if (!isLiveApiEnabled()) return
        let cancelled = false
        ;(async () => {
            const [dashRes, inboxRes] = await Promise.all([
                getAdminDashboard(),
                listApprovalsInbox(),
            ])
            if (cancelled) return
            if (dashRes.success) setLiveKpis(dashRes.data)
            if (inboxRes.success) {
                setPendingApprovals(
                    (inboxRes.data || []).filter(
                        (row) => String(row.status || '').toLowerCase() === 'pending',
                    ).length,
                )
            }
        })()
        return () => { cancelled = true }
    }, [])

    const counts = {
        students: liveKpis?.students,
        employees: liveKpis?.employees,
        pendingApprovals,
    }

    const kpiCards = [
        {
            label: 'Students',
            value: liveKpis?.students ?? '—',
            hint: 'Campus student directory',
            to: '/super-admin/user-database/students',
            accent: 'border-l-indigo-600',
            hover: 'group-hover:text-indigo-600',
        },
        {
            label: 'Employees',
            value: liveKpis?.employees ?? '—',
            hint: 'Staff directory',
            to: '/super-admin/user-database/employees',
            accent: 'border-l-emerald-600',
            hover: 'group-hover:text-emerald-600',
        },
        {
            label: 'Leave requests',
            value: liveKpis?.leaveRequests ?? '—',
            hint: 'Campus leave queue',
            to: '/super-admin/leave-request/received',
            accent: 'border-l-blue-600',
            hover: 'group-hover:text-blue-600',
        },
        {
            label: 'Pending decisions',
            value: pendingApprovals ?? '—',
            hint: 'Awaiting Super Admin sanction',
            to: '/super-admin/approvals',
            accent: 'border-l-amber-500',
            hover: 'group-hover:text-amber-600',
        },
    ]

    return (
        <section className='space-y-6 max-w-7xl mx-auto pb-10'>
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
                        Campus overview and shortcuts for Super Admin modules.
                    </p>
                </div>

                <div className='flex items-center gap-2 flex-wrap'>
                    <Link
                        to='/super-admin/approvals'
                        className='px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors inline-flex items-center gap-1.5'
                    >
                        <ClipboardCheck size={14} />
                        <span>Pending Approvals ({pendingApprovals ?? '—'})</span>
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

            <div>
                <h2 className='text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5'>
                    Direct Role & User Management Navigation
                </h2>
                <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3'>
                    {QUICK_NAV_LINKS.map((link) => {
                        const Icon = link.icon
                        const liveCount = link.countKey != null ? counts[link.countKey] : null
                        const badge = liveCount == null ? (link.fallback || 'Open') : String(liveCount)
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
                                        {badge}
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

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                {kpiCards.map((card) => (
                    <Link
                        key={card.label}
                        to={card.to}
                        className={`bg-white rounded-2xl border border-slate-200 p-4 shadow-xs border-l-4 ${card.accent} hover:shadow-md transition-all group`}
                    >
                        <div className='flex items-center justify-between'>
                            <span className='text-xs font-semibold uppercase tracking-wider text-slate-400 block'>
                                {card.label}
                            </span>
                            <ArrowUpRight size={14} className={`text-slate-400 ${card.hover} group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform`} />
                        </div>
                        <p className='text-2xl font-bold text-slate-900 mt-1'>{card.value}</p>
                        <span className='text-xs text-slate-500 font-medium block mt-1'>{card.hint}</span>
                    </Link>
                ))}
            </div>
        </section>
    )
}

export default Dashboard
