import React, { useState, useMemo } from 'react'
import {
    Search,
    ArrowLeft,
    Clock,
    LogIn,
    Compass,
    FileText,
    CheckCircle2,
    Eye,
    Edit3,
    Laptop,
    Globe,
    X,
    ChevronRight,
    Activity
} from 'lucide-react'
import { ENTERPRISE_USER_DIRECTORY } from '../../Authentication/enterpriseUserDirectory'
import {
    LOGIN_HISTORY_LOGS,
    DATA_CHANGES_LOGS,
    APPROVAL_ACTIONS_LOGS
} from './activityLogsData'

// Generate rich activity timeline events for a user
export const getUserTimelineEvents = (user) => {
    if (!user) return []

    const userEmail = (user.email || '').toLowerCase()
    const userName = (user.name || '').toLowerCase()
    const userRole = (user.role || '').toLowerCase()

    // Match existing static logs
    const loginLogs = LOGIN_HISTORY_LOGS.filter(
        (l) => (l.userEmail || '').toLowerCase() === userEmail || (l.user || '').toLowerCase().includes(userName)
    ).map((l) => ({
        id: l.id,
        category: 'Logins & Sessions',
        action: 'User Logged In',
        title: `Logged into ERP Web Portal`,
        description: `Successful authentication via credentials on ${l.device}`,
        module: 'Authentication & Session',
        target: l.sessionId,
        timestamp: l.timestamp,
        sessionDuration: '48 mins',
        device: l.device || 'Chrome 126 · Windows 11',
        ip: l.ipAddress || '192.168.10.15',
        status: l.status || 'Success',
        details: { SessionId: l.sessionId, Location: l.location || 'Chennai, IN' }
    }))

    const dataChangeLogs = DATA_CHANGES_LOGS.filter(
        (l) => (l.user || '').toLowerCase().includes(userName) || (l.userRole || '').toLowerCase().includes(userRole)
    ).map((l) => {
        const previous = l.oldValue ?? l.previousValue ?? l.before
        const updated = l.newValue ?? l.updatedValue ?? l.after
        return {
            id: l.id,
            category: 'Form Submissions & Edits',
            action: 'Form Data Update',
            title: `Updated ${l.module} Record`,
            description: `Modified field "${l.fieldChanged || l.fieldModified || 'General'}" on record #${l.recordId}`,
            module: l.module,
            target: l.recordId,
            timestamp: l.timestamp,
            sessionDuration: '—',
            device: 'Chrome 126 · Windows 11',
            ip: l.ipAddress || '192.168.10.15',
            status: 'Success',
            details: {
                Before: previous == null || previous === '' ? '—' : String(previous),
                After: updated == null || updated === '' ? '—' : String(updated),
            },
        }
    })

    const approvalLogs = APPROVAL_ACTIONS_LOGS.filter(
        (l) => (l.approver || '').toLowerCase().includes(userName) || (l.approverRole || '').toLowerCase().includes(userRole)
    ).map((l) => ({
        id: l.id,
        category: 'Tasks & Approvals',
        action: 'Workflow Sanction',
        title: `${l.status || 'Approved'} ${l.module} Request`,
        description: `Processed administrative workflow approval for reference #${l.referenceNo}`,
        module: l.module,
        target: l.referenceNo,
        timestamp: l.timestamp,
        sessionDuration: '—',
        device: 'Edge 125 · Windows 11',
        ip: '192.168.10.18',
        status: l.status || 'Approved',
        details: { Remarks: l.remarks || 'Sanctioned per standard operating procedure.' }
    }))

    // Synthesized realistic module navigation and record events tailored to the role
    const defaultEvents = [
        {
            id: `ev-${user.id}-01`,
            category: 'Logins & Sessions',
            action: 'Session Active',
            title: 'Logged in to School ERP Portal',
            description: 'Authentication confirmed with multi-tier role authorization',
            module: 'Authentication',
            target: `SES-${user.employeeId}-994`,
            timestamp: '08-08-2026 08:30 AM',
            sessionDuration: '1 hr 12 mins',
            device: 'Chrome 126 · Windows 11',
            ip: '192.168.10.22',
            status: 'Success',
            details: { AuthType: 'Role Credentials', SessionId: `SES-${user.employeeId}-994` }
        },
        {
            id: `ev-${user.id}-02`,
            category: 'Module Navigation',
            action: 'Page Visit',
            title: `Navigated to ${user.department || 'Dashboard'}`,
            description: `Loaded departmental module dashboard and verified active KPIs`,
            module: user.department || 'Operations',
            target: '/dashboard',
            timestamp: '08-08-2026 08:35 AM',
            sessionDuration: '5 mins',
            device: 'Chrome 126 · Windows 11',
            ip: '192.168.10.22',
            status: 'Success',
            details: { Route: `/${(user.role || 'user').toLowerCase()}/dashboard` }
        },
        {
            id: `ev-${user.id}-03`,
            category: 'Records Viewed & Updated',
            action: 'Record Inspection',
            title: `Inspected ${user.roleLabel || 'Staff'} Work Dossier`,
            description: 'Reviewed active quarterly metrics, notifications, and pending items',
            module: 'Governance & Operations',
            target: `REC-${user.employeeId}-Q3`,
            timestamp: '08-08-2026 09:15 AM',
            sessionDuration: '18 mins',
            device: 'Chrome 126 · Windows 11',
            ip: '192.168.10.22',
            status: 'Completed',
            details: { Action: 'VIEW', Category: 'Audit Ledger' }
        },
        {
            id: `ev-${user.id}-04`,
            category: 'Form Submissions & Edits',
            action: 'Submission',
            title: 'Submitted Operational Request Form',
            description: 'Created formal electronic entry with verified payload and timestamp',
            module: 'Process Management',
            target: `DOC-2026-081`,
            timestamp: '08-08-2026 10:20 AM',
            sessionDuration: '12 mins',
            device: 'Chrome 126 · Windows 11',
            ip: '192.168.10.22',
            status: 'Completed',
            details: { FormType: 'Operational Requisition', Verification: 'Valid' }
        },
        {
            id: `ev-${user.id}-05`,
            category: 'Tasks & Approvals',
            action: 'Task Update',
            title: 'Updated Assigned Task Status',
            description: 'Marked assigned enterprise task to In Progress with status notes',
            module: 'Task Management',
            target: 'TSK-2026-042',
            timestamp: '08-08-2026 11:05 AM',
            sessionDuration: '8 mins',
            device: 'Chrome 126 · Windows 11',
            ip: '192.168.10.22',
            status: 'In Progress',
            details: { StatusTransition: 'Assigned -> In Progress' }
        },
        {
            id: `ev-${user.id}-06`,
            category: 'File & Document Actions',
            action: 'File Export',
            title: 'Downloaded Audit & Reports Summary',
            description: 'Exported quarterly analytical summary report in CSV format',
            module: 'Reports & Analytics',
            target: 'Report_Q3_Summary.csv',
            timestamp: '08-08-2026 01:40 PM',
            sessionDuration: '4 mins',
            device: 'Chrome 126 · Windows 11',
            ip: '192.168.10.22',
            status: 'Success',
            details: { ExportFormat: 'CSV', FileSize: '248 KB' }
        },
        {
            id: `ev-${user.id}-07`,
            category: 'Logins & Sessions',
            action: 'User Logged Out',
            title: 'Closed ERP Portal Session',
            description: 'Manual session termination with authentication cookie cleared',
            module: 'Authentication',
            target: `SES-${user.employeeId}-994`,
            timestamp: '08-08-2026 05:15 PM',
            sessionDuration: '45 mins (Session 2)',
            device: 'Chrome 126 · Windows 11',
            ip: '192.168.10.22',
            status: 'Completed',
            details: { SessionEnded: 'True', Reason: 'Normal Logout' }
        }
    ]

    return [...loginLogs, ...dataChangeLogs, ...approvalLogs, ...defaultEvents].sort(
        (a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')
    )
}

export const ACTION_CATEGORIES = [
    'All Action Types',
    'Logins & Sessions',
    'Module Navigation',
    'Form Submissions & Edits',
    'Records Viewed & Updated',
    'Tasks & Approvals',
    'File & Document Actions'
]

export default function UserActivityTimeline({ initialUserId = null, onClose = null }) {
    const [selectedUserId, setSelectedUserId] = useState(initialUserId)
    const [userSearchTerm, setUserSearchTerm] = useState('')
    const [selectedCategoryTab, setSelectedCategoryTab] = useState('All')
    const [actionTypeFilter, setActionTypeFilter] = useState('All Action Types')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [eventSearchTerm, setEventSearchTerm] = useState('')

    // Selected user
    const selectedUser = useMemo(() => {
        if (!selectedUserId) return null
        return ENTERPRISE_USER_DIRECTORY.find((u) => u.id === selectedUserId || u.employeeId === selectedUserId) || null
    }, [selectedUserId])

    // Filtered user list
    const filteredUsers = useMemo(() => {
        return ENTERPRISE_USER_DIRECTORY.filter((u) => {
            if (userSearchTerm) {
                const q = userSearchTerm.toLowerCase()
                const matchName = (u.name || '').toLowerCase().includes(q)
                const matchEmail = (u.email || '').toLowerCase().includes(q)
                const matchRole = (u.roleLabel || u.role || '').toLowerCase().includes(q)
                const matchDept = (u.department || '').toLowerCase().includes(q)
                const matchEmpId = (u.employeeId || '').toLowerCase().includes(q)
                if (!matchName && !matchEmail && !matchRole && !matchDept && !matchEmpId) return false
            }
            if (selectedCategoryTab !== 'All' && u.category !== selectedCategoryTab) {
                return false
            }
            return true
        })
    }, [userSearchTerm, selectedCategoryTab])

    // Timeline events for selected user
    const rawEvents = useMemo(() => {
        return getUserTimelineEvents(selectedUser)
    }, [selectedUser])

    // Filtered timeline events
    const filteredEvents = useMemo(() => {
        return rawEvents.filter((ev) => {
            if (actionTypeFilter !== 'All Action Types' && ev.category !== actionTypeFilter) {
                return false
            }
            if (eventSearchTerm) {
                const q = eventSearchTerm.toLowerCase()
                const matchTitle = (ev.title || '').toLowerCase().includes(q)
                const matchDesc = (ev.description || '').toLowerCase().includes(q)
                const matchModule = (ev.module || '').toLowerCase().includes(q)
                const matchTarget = (ev.target || '').toLowerCase().includes(q)
                if (!matchTitle && !matchDesc && !matchModule && !matchTarget) return false
            }
            if (dateFrom && ev.timestamp) {
                // simple date comparison if timestamp contains format DD-MM-YYYY
                const parts = ev.timestamp.split(' ')[0].split('-')
                if (parts.length === 3) {
                    const iso = `${parts[2]}-${parts[1]}-${parts[0]}`
                    if (iso < dateFrom) return false
                }
            }
            if (dateTo && ev.timestamp) {
                const parts = ev.timestamp.split(' ')[0].split('-')
                if (parts.length === 3) {
                    const iso = `${parts[2]}-${parts[1]}-${parts[0]}`
                    if (iso > dateTo) return false
                }
            }
            return true
        })
    }, [rawEvents, actionTypeFilter, eventSearchTerm, dateFrom, dateTo])

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'Logins & Sessions':
                return <LogIn size={15} className="text-blue-600" />
            case 'Module Navigation':
                return <Compass size={15} className="text-purple-600" />
            case 'Form Submissions & Edits':
                return <Edit3 size={15} className="text-amber-600" />
            case 'Records Viewed & Updated':
                return <Eye size={15} className="text-cyan-600" />
            case 'Tasks & Approvals':
                return <CheckCircle2 size={15} className="text-emerald-600" />
            case 'File & Document Actions':
                return <FileText size={15} className="text-indigo-600" />
            default:
                return <Activity size={15} className="text-slate-600" />
        }
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Success':
            case 'Completed':
            case 'Approved':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200'
            case 'In Progress':
                return 'bg-blue-50 text-blue-700 border-blue-200'
            case 'Failed':
            case 'Rejected':
                return 'bg-rose-50 text-rose-700 border-rose-200'
            default:
                return 'bg-slate-50 text-slate-700 border-slate-200'
        }
    }

    // -------------------------------------------------------------------------
    // VIEW 1: SEARCHABLE USER DIRECTORY TABLE
    // -------------------------------------------------------------------------
    if (!selectedUser) {
        return (
            <div className="space-y-5">
                {/* Header Summary */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-slate-900">User Activity Timeline Directory</h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                29 Institutional Users
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Select any user to inspect their end-to-end audit trail, session durations, module navigation, form actions, and security history.
                        </p>
                    </div>

                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer shrink-0"
                        >
                            <X size={15} /> Close Tracker
                        </button>
                    )}
                </div>

                {/* Filter & Search Bar */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by staff name, email, employee ID, role, or department..."
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50/60 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto sidebar-scroll-hide">
                        {['All', 'Leadership & Executive', 'Academics & Teaching', 'Logistics & Campus Operations', 'Finance & Administration'].map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setSelectedCategoryTab(tab)}
                                className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                                    selectedCategoryTab === tab
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* User Cards / Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                                    <th className="px-5 py-3.5">User Identity</th>
                                    <th className="px-5 py-3.5">Role & Department</th>
                                    <th className="px-5 py-3.5">Campus Unit</th>
                                    <th className="px-5 py-3.5">Last Active Session</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                                            No institutional users found matching your search criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((u) => (
                                        <tr
                                            key={u.id}
                                            onClick={() => setSelectedUserId(u.id)}
                                            className="hover:bg-blue-50/40 transition cursor-pointer group"
                                        >
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="size-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-2xs"
                                                        style={{ backgroundColor: u.avatarColor || '#3B82F6' }}
                                                    >
                                                        {u.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 group-hover:text-blue-600 transition">
                                                            {u.name}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 font-mono">
                                                            {u.email} · #{u.employeeId}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <p className="font-semibold text-slate-800">{u.roleLabel}</p>
                                                <p className="text-[11px] text-slate-500">{u.department}</p>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600 font-medium">
                                                {u.campus || 'Central Headquarters'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-1.5 text-slate-700">
                                                    <Clock size={13} className="text-slate-400" />
                                                    <span>Today, 08:30 AM</span>
                                                </div>
                                                <span className="text-[10px] text-slate-400">Chrome · Win 11</span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <span className="size-1.5 rounded-full bg-emerald-500"></span> Active
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSelectedUserId(u.id)
                                                    }}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 font-bold text-xs shadow-2xs transition"
                                                >
                                                    View Timeline <ChevronRight size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )
    }

    // -------------------------------------------------------------------------
    // VIEW 2: DETAILED USER ACTIVITY TIMELINE
    // -------------------------------------------------------------------------
    return (
        <div className="space-y-5 animate-fade-in">
            {/* Top Navigation & Profile Header */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <button
                        type="button"
                        onClick={() => setSelectedUserId(null)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs"
                    >
                        <ArrowLeft size={16} className="text-blue-600" /> Back to User Directory
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">
                            Viewing audit log for: <strong className="text-slate-800">{selectedUser.name}</strong>
                        </span>
                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* User Identity Card */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div
                            className="size-14 rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow-md shrink-0"
                            style={{ backgroundColor: selectedUser.avatarColor || '#3B82F6' }}
                        >
                            {selectedUser.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-xl font-bold text-slate-900">{selectedUser.name}</h1>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    {selectedUser.roleLabel}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {selectedUser.department} · {selectedUser.designation} · #{selectedUser.employeeId} · {selectedUser.email}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-left">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                                Total Logged Events
                            </span>
                            <span className="text-base font-bold text-slate-900">{rawEvents.length} Actions</span>
                        </div>
                        <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-left">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                                Client Session
                            </span>
                            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mt-0.5">
                                <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span> Active
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {/* Search inside user events */}
                    <div>
                        <label className="block text-slate-600 font-semibold mb-1">Search Events</label>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Action, target, module..."
                                value={eventSearchTerm}
                                onChange={(e) => setEventSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white text-slate-800"
                            />
                        </div>
                    </div>

                    {/* Action Category Filter */}
                    <div>
                        <label className="block text-slate-600 font-semibold mb-1">Action Category</label>
                        <select
                            value={actionTypeFilter}
                            onChange={(e) => setActionTypeFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white text-slate-800 font-medium"
                        >
                            {ACTION_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* From Date */}
                    <div>
                        <label className="block text-slate-600 font-semibold mb-1">From Date</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white text-slate-800"
                        />
                    </div>

                    {/* To Date */}
                    <div>
                        <label className="block text-slate-600 font-semibold mb-1">To Date</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white text-slate-800"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500 font-medium">
                        Showing {filteredEvents.length} matching event{filteredEvents.length !== 1 ? 's' : ''} out of {rawEvents.length} total
                    </span>
                    {(eventSearchTerm || actionTypeFilter !== 'All Action Types' || dateFrom || dateTo) && (
                        <button
                            type="button"
                            onClick={() => {
                                setEventSearchTerm('')
                                setActionTypeFilter('All Action Types')
                                setDateFrom('')
                                setDateTo('')
                            }}
                            className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Interactive Timeline Feed */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6">
                {filteredEvents.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                        <Clock size={36} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">No activity events found for the selected filters.</p>
                        <p className="text-xs text-slate-400 mt-1">Try resetting the date range or action type filter.</p>
                    </div>
                ) : (
                    <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                        {filteredEvents.map((ev) => (
                            <div key={ev.id} className="relative group">
                                {/* Connector Dot */}
                                <div className="absolute -left-6 sm:-left-8 top-1.5 size-6 rounded-full bg-white border-2 border-slate-300 group-hover:border-blue-500 flex items-center justify-center transition shadow-2xs">
                                    <div className="size-2 rounded-full bg-slate-400 group-hover:bg-blue-600 transition" />
                                </div>

                                {/* Event Card */}
                                <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="p-1 rounded-md bg-slate-100">
                                                {getCategoryIcon(ev.category)}
                                            </span>
                                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                                                {ev.title}
                                            </h4>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                                {ev.module}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0">
                                            <Clock size={12} className="text-slate-400" />
                                            <span className="font-medium text-slate-700">{ev.timestamp}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(ev.status)}`}>
                                                {ev.status}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-xs text-slate-600">
                                        {ev.description}
                                    </p>

                                    {/* Event Details Grid */}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <Laptop size={12} className="text-slate-400" /> {ev.device}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Globe size={12} className="text-slate-400" /> {ev.ip}
                                        </span>
                                        {ev.sessionDuration && ev.sessionDuration !== '—' && (
                                            <span className="flex items-center gap-1 text-slate-700 font-medium">
                                                <Clock size={12} className="text-blue-500" /> Duration: {ev.sessionDuration}
                                            </span>
                                        )}
                                        {ev.target && (
                                            <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                                ref: {ev.target}
                                            </span>
                                        )}
                                    </div>

                                    {/* Key Details Tags if present */}
                                    {ev.details && Object.keys(ev.details).length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {Object.entries(ev.details).map(([k, v]) => (
                                                <span key={k} className="text-[10px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded font-mono">
                                                    <strong>{k}:</strong> {String(v)}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
