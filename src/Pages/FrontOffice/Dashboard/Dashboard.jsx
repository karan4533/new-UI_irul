import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
    GraduationCap,
    Calendar,
    Filter,
    RotateCcw,
    Info,
    Plus,
    Users,
    UserCheck,
    ShieldCheck,
    FileText,
    Clock,
    CheckCircle2,
    UserPlus,
    ArrowUpRight,
} from 'lucide-react'
import { listAdmissionEnquiries, listAdmissions } from '../../../services/api/admissionsApiService'
import { listFrontOfficeCollection } from '../../../services/api/frontOfficeApiService'
import { hydrateOpsCollection } from '../../../services/api/opsLiveStore'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listTcRequests } from '../../../services/api/tcApiService'

const DEMO_KPIS = {
    enquiries: 0,
    visitorsToday: 0,
    pendingDocs: 0,
    gatePasses: 0,
}

const todayKey = () => new Date().toLocaleDateString('en-GB').replace(/\//g, '-')

const formatShortDate = (value) => {
    if (!value) return '—'
    const raw = String(value).slice(0, 10)
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return raw
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatWhen = (value) => {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    const today = new Date()
    const sameDay = d.toDateString() === today.toDateString()
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    return sameDay ? `Today, ${time}` : `${formatShortDate(d)} ${time}`
}

const Dashboard = () => {
    const navigate = useNavigate()
    const live = isLiveApiEnabled()

    const [academicYear, setAcademicYear] = useState('2026 - 2027')
    const [dateRange, setDateRange] = useState('01 Oct 2026 - 31 Oct 2026')
    const [appliedFilters, setAppliedFilters] = useState({
        academicYear: '2026 - 2027',
        dateRange: '01 Oct 2026 - 31 Oct 2026',
    })

    const [kpis, setKpis] = useState(() => (live ? {
        enquiries: null,
        visitorsToday: null,
        pendingDocs: null,
        gatePasses: null,
    } : DEMO_KPIS))
    const [kpisLoading, setKpisLoading] = useState(Boolean(live))
    const [recentActivity, setRecentActivity] = useState([])
    const [followUps, setFollowUps] = useState([])

    useEffect(() => {
        if (!isLiveApiEnabled()) return undefined
        let cancelled = false
        setKpisLoading(true)
        ;(async () => {
            const [enquiriesRes, admissionsRes, visitorsRes, gateRes, tcRes] = await Promise.all([
                listAdmissionEnquiries(),
                listAdmissions(),
                hydrateOpsCollection('ops:gate-visitors', { force: true }),
                listFrontOfficeCollection('student-gate-passes'),
                listTcRequests().catch(() => ({ success: false, data: [] })),
            ])
            if (cancelled) return

            const enquiries = Array.isArray(enquiriesRes?.data) ? enquiriesRes.data : []
            const admissions = Array.isArray(admissionsRes?.data) ? admissionsRes.data : []
            const visitors = Array.isArray(visitorsRes?.rows) ? visitorsRes.rows : []
            const gatePasses = Array.isArray(gateRes?.data) ? gateRes.data : []
            const tcRows = Array.isArray(tcRes?.data) ? tcRes.data : []

            const pendingDocs = admissions.filter((row) => {
                const status = String(row.status || row.documentStatus || '').toLowerCase()
                return status.includes('pending') || status.includes('document') || status.includes('verification')
            }).length
            const pendingTc = tcRows.filter((row) =>
                String(row.status || '').toLowerCase().includes('pending'),
            ).length
            const today = todayKey()
            const visitorsToday = visitors.filter((row) => {
                const entry = String(row.entryDate || row.date || '').replace(/\//g, '-')
                return entry === today || String(row.status || '').toLowerCase().includes('checked in')
            }).length

            setKpis({
                enquiries: enquiries.length,
                visitorsToday,
                pendingDocs: pendingDocs || pendingTc,
                gatePasses: gatePasses.length,
            })

            const activity = []
            enquiries.slice(0, 6).forEach((row) => {
                activity.push({
                    id: `enq-${row.id}`,
                    when: row.enquiryDate || row.createdAt || row._createdAt || '',
                    title: 'New enquiry registered',
                    detail: [row.name || row.studentName || 'Enquiry', row.className || row.grade].filter(Boolean).join(' · '),
                    tag: 'Enquiry',
                    tagClass: 'bg-blue-50 text-blue-700',
                    icon: 'enquiry',
                    to: '/front-office/admission-enquiry',
                })
            })
            visitors.slice(0, 6).forEach((row) => {
                activity.push({
                    id: `vis-${row.id || row.badgeNumber}`,
                    when: row.checkInAt || row.entryDate || row.createdAt || row._createdAt || '',
                    title: 'Visitor checked in',
                    detail: [row.visitorName || row.name || 'Visitor', row.purpose || row.visitorType].filter(Boolean).join(' · '),
                    tag: 'Visitor',
                    tagClass: 'bg-indigo-50 text-indigo-700',
                    icon: 'visitor',
                    to: '/front-office/visitors',
                })
            })
            gatePasses.slice(0, 6).forEach((row) => {
                activity.push({
                    id: `gp-${row.id}`,
                    when: row.date || row.createdAt || row._createdAt || '',
                    title: 'Gate pass issued',
                    detail: [row.studentName || row.carrierName || row.id, row.reason || row.status].filter(Boolean).join(' · '),
                    tag: 'Gate Pass',
                    tagClass: 'bg-emerald-50 text-emerald-700',
                    icon: 'gate',
                    to: '/front-office/gate-pass-list',
                })
            })
            activity.sort((a, b) => String(b.when).localeCompare(String(a.when)))
            setRecentActivity(activity.slice(0, 6))

            const follow = enquiries
                .filter((row) => {
                    const status = String(row.status || '').toLowerCase()
                    return Boolean(row.nextFollowUpDate)
                        || status.includes('pending')
                        || status.includes('follow')
                        || status.includes('active')
                        || status.includes('open')
                })
                .slice(0, 8)
                .map((row) => ({
                    id: row.id,
                    name: row.name || row.studentName || '—',
                    grade: row.className || row.grade || '—',
                    lastContact: formatShortDate(row.enquiryDate || row.updatedAt || row._updatedAt),
                    nextFollowUp: formatShortDate(row.nextFollowUpDate),
                    status: row.status || 'Pending',
                }))
            setFollowUps(follow)
            setKpisLoading(false)
        })()
        return () => { cancelled = true }
    }, [])

    const handleApplyFilters = () => {
        setAppliedFilters({ academicYear, dateRange })
        toast.success(`Filters applied for Academic Year: ${academicYear}`)
    }

    const handleReset = () => {
        setAcademicYear('2026 - 2027')
        setDateRange('01 Oct 2026 - 31 Oct 2026')
        setAppliedFilters({ academicYear: '2026 - 2027', dateRange: '01 Oct 2026 - 31 Oct 2026' })
        toast.info('Filters reset to default')
    }

    const display = useMemo(() => ({
        enquiries: kpis.enquiries == null ? (kpisLoading ? '…' : '0') : String(kpis.enquiries),
        visitorsToday: kpis.visitorsToday == null ? (kpisLoading ? '…' : '0') : String(kpis.visitorsToday),
        pendingDocs: kpis.pendingDocs == null ? (kpisLoading ? '…' : '0') : String(kpis.pendingDocs),
        gatePasses: kpis.gatePasses == null ? (kpisLoading ? '…' : '0') : String(kpis.gatePasses),
    }), [kpis, kpisLoading])

    const activityIcon = (kind) => {
        if (kind === 'visitor') return <Users className="w-3.5 h-3.5" />
        if (kind === 'gate') return <ShieldCheck className="w-3.5 h-3.5" />
        if (kind === 'document') return <FileText className="w-3.5 h-3.5" />
        return <UserPlus className="w-3.5 h-3.5" />
    }

    return (
        <div className="space-y-5 pb-8">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#3B5CEB] flex items-center justify-center shrink-0">
                        <GraduationCap className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                        <label className="block text-[11px] font-medium text-gray-400 mb-0.5">Academic Year</label>
                        <select
                            value={academicYear}
                            onChange={(e) => setAcademicYear(e.target.value)}
                            className="w-full text-sm font-semibold text-gray-800 bg-transparent outline-none cursor-pointer"
                        >
                            <option value="2026 - 2027">2026 - 2027</option>
                            <option value="2025 - 2026">2025 - 2026</option>
                            <option value="2024 - 2025">2024 - 2025</option>
                        </select>
                    </div>
                </div>
                <div className="hidden lg:block w-px h-8 bg-gray-100" />
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#3B5CEB] flex items-center justify-center shrink-0">
                        <Calendar className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                        <label className="block text-[11px] font-medium text-gray-400 mb-0.5">Date Range</label>
                        <input
                            type="text"
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="w-full text-sm font-semibold text-gray-800 bg-transparent outline-none"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={handleApplyFilters}
                        className="bg-[#3B5CEB] hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                        <Filter className="w-3.5 h-3.5" />
                        <span>Apply</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleReset}
                        className="border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold px-3.5 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                        <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                        <span>Reset</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Front Office Overview</h1>
                        {!live ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                <Info className="w-3 h-3 text-blue-600" />
                                <span>Demo data</span>
                            </span>
                        ) : null}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                        {live
                            ? `Live campus counts for enquiries, visitors, pending items and gate passes. Session: ${appliedFilters.academicYear}.`
                            : `Enable live API to load campus counts. Session: ${appliedFilters.academicYear}.`}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => navigate('/front-office/admission-enquiry/add')}
                        className="bg-[#3B5CEB] hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>Register Enquiry</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/front-office/visitors')}
                        className="bg-white border border-[#3B5CEB] text-[#3B5CEB] hover:bg-blue-50 text-xs font-semibold px-3.5 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                        <Users className="w-4 h-4" />
                        <span>Check In Visitor</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/front-office/add-gate-pass')}
                        className="bg-white border border-[#3B5CEB] text-[#3B5CEB] hover:bg-blue-50 text-xs font-semibold px-3.5 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Issue Gate Pass</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <Link
                    to="/front-office/admission-enquiry"
                    className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#3B5CEB] mb-2.5 group-hover:bg-[#3B5CEB] group-hover:text-white transition-colors">
                        <Users className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-500 group-hover:text-blue-600 transition-colors">New Enquiries</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mt-0.5">{display.enquiries}</div>
                    <div className="mt-1 text-[11px] text-gray-400">Open admission enquiries</div>
                </Link>

                <Link
                    to="/front-office/visitors"
                    className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#3B5CEB] mb-2.5 group-hover:bg-[#3B5CEB] group-hover:text-white transition-colors">
                        <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-500 group-hover:text-blue-600 transition-colors">Today&apos;s Visitors</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mt-0.5">{display.visitorsToday}</div>
                    <div className="mt-1 text-[11px] text-gray-400">Checked in / today</div>
                </Link>

                <Link
                    to="/front-office/tc-request"
                    className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#3B5CEB] mb-2.5 group-hover:bg-[#3B5CEB] group-hover:text-white transition-colors">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-500 group-hover:text-blue-600 transition-colors">Pending items</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mt-0.5">{display.pendingDocs}</div>
                    <div className="mt-1 text-[11px] text-gray-400">Admissions / TC pending</div>
                </Link>

                <Link
                    to="/front-office/gate-pass-list"
                    className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#3B5CEB] mb-2.5 group-hover:bg-[#3B5CEB] group-hover:text-white transition-colors">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-500 group-hover:text-blue-600 transition-colors">Gate Passes Issued</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mt-0.5">{display.gatePasses}</div>
                    <div className="mt-1 text-[11px] text-gray-400">Student gate passes</div>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <h3 className="text-sm font-bold text-gray-900">Recent Activity</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/front-office/admission-enquiry')}
                            className="text-xs font-semibold text-[#3B5CEB] hover:underline cursor-pointer"
                        >
                            View All
                        </button>
                    </div>

                    <div className="mt-4 space-y-4">
                        {kpisLoading ? (
                            <p className="text-xs text-gray-400">Loading recent campus activity…</p>
                        ) : recentActivity.length === 0 ? (
                            <p className="text-xs text-gray-400">No recent enquiries, visitors or gate passes yet.</p>
                        ) : (
                            recentActivity.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => navigate(item.to)}
                                    className="w-full flex items-start justify-between gap-3 text-left cursor-pointer hover:opacity-90"
                                >
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="w-2 h-2 rounded-full bg-blue-600 mt-2 shrink-0" />
                                        <span className="text-xs text-gray-400 w-28 shrink-0 pt-0.5 whitespace-nowrap">
                                            {formatWhen(item.when)}
                                        </span>
                                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                            {activityIcon(item.icon)}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-semibold text-gray-800 truncate">{item.title}</h4>
                                            <p className="text-[11px] text-gray-500 truncate">{item.detail}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${item.tagClass}`}>
                                        {item.tag}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                            <h3 className="text-sm font-bold text-gray-900">Follow-up List</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/front-office/admission-enquiry')}
                            className="text-xs font-semibold text-[#3B5CEB] hover:underline cursor-pointer"
                        >
                            View All
                        </button>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                        {kpisLoading ? (
                            <p className="text-xs text-gray-400">Loading follow-ups…</p>
                        ) : followUps.length === 0 ? (
                            <p className="text-xs text-gray-400">No open enquiry follow-ups.</p>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 text-[11px] font-medium text-gray-400 whitespace-nowrap">
                                        <th className="pb-2.5 font-medium pr-3">Enquiry ID</th>
                                        <th className="pb-2.5 font-medium pr-3">Name</th>
                                        <th className="pb-2.5 font-medium pr-3">Grade</th>
                                        <th className="pb-2.5 font-medium pr-3">Last Contact</th>
                                        <th className="pb-2.5 font-medium pr-3">Next Follow-up</th>
                                        <th className="pb-2.5 font-medium text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-xs whitespace-nowrap">
                                    {followUps.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="cursor-pointer hover:bg-slate-50"
                                            onClick={() => navigate('/front-office/admission-enquiry')}
                                        >
                                            <td className="py-2.5 font-medium text-gray-700 pr-3">{row.id}</td>
                                            <td className="py-2.5 font-semibold text-gray-900 pr-3">{row.name}</td>
                                            <td className="py-2.5 text-gray-600 pr-3">{row.grade}</td>
                                            <td className="py-2.5 text-gray-500 pr-3">{row.lastContact}</td>
                                            <td className="py-2.5 text-gray-500 pr-3">{row.nextFollowUp}</td>
                                            <td className="py-2.5 text-right">
                                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                    {row.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Dashboard
