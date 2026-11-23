import React, { useEffect, useMemo, useState } from 'react'
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
    Activity,
} from 'lucide-react'
import { ENTERPRISE_USER_DIRECTORY } from '../../Authentication/enterpriseUserDirectory'
import {
    LOGIN_HISTORY_LOGS,
    DATA_CHANGES_LOGS,
    APPROVAL_ACTIONS_LOGS,
} from './activityLogsData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import { listAdminUsers } from '../../../services/api/adminUsersApiService'
import { listAuditLogs } from '../../../services/api/auditLogsApiService'

const AVATAR_COLORS = ['#3B82F6', '#0F766E', '#7C3AED', '#C2410C', '#BE123C', '#0369A1', '#4F46E5', '#15803D']

function roleCategory(role = '', department = '') {
    const hay = `${role} ${department}`.toLowerCase()
    if (/financ|account|fee|cashier|payroll/.test(hay)) return 'Finance & Administration'
    if (/transport|store|security|campus|ops|front.?office|logistics|procure/.test(hay)) {
        return 'Logistics & Campus Operations'
    }
    if (/teacher|academic|hod|exam|faculty|tutor/.test(hay)) return 'Academics & Teaching'
    return 'Leadership & Executive'
}

function avatarColorFor(id = '') {
    let hash = 0
    const key = String(id)
    for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i) * (i + 1)) % AVATAR_COLORS.length
    return AVATAR_COLORS[hash]
}

function initialsFromName(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return '?'
    return parts.map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

function formatLastActive(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    if (sameDay) return `Today, ${time}`
    return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    })
}

function humanizeAction(action = '') {
    return String(action)
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
}

function categoryForAction(action = '', entityType = '') {
    const hay = `${action} ${entityType}`
    if (/LOGIN|LOGOUT|OTP|PASSWORD|SESSION/i.test(hay)) return 'Logins & Sessions'
    if (/APPROV|DECIDE|DENY|REJECT|SANCTION/i.test(hay)) return 'Tasks & Approvals'
    if (/DELETE|EXPORT|DOWNLOAD|UPLOAD|FILE|DOCUMENT/i.test(hay)) return 'File & Document Actions'
    if (/CREATE|UPDATE|PATCH|UPSERT|SUBMIT|EDIT/i.test(hay)) return 'Form Submissions & Edits'
    if (/VIEW|READ|LIST|GET/i.test(hay)) return 'Records Viewed & Updated'
    return 'Module Navigation'
}

function eventStatus(action = '', mappedStatus = '') {
    if (mappedStatus && mappedStatus !== '—' && mappedStatus !== action) return mappedStatus
    if (/FAIL|LOCK|BLOCK|UNKNOWN|DENIED|REJECT/i.test(action)) return 'Failed'
    if (/LOGOUT/i.test(action)) return 'Logout'
    if (/APPROV/i.test(action)) return 'Approved'
    return 'Success'
}

function mapAuditRecordToTimelineEvent(record) {
    const action = record.action || 'Activity'
    const module = record.module || record.scope || 'System'
    const title = humanizeAction(action)
    const description =
        record.description && record.description !== '—'
            ? record.description
            : `${title} on ${module}`
    return {
        id: record.id,
        category: categoryForAction(action, module),
        action,
        title,
        description,
        module,
        target: record.recordId && record.recordId !== '—' ? record.recordId : null,
        timestamp: record.timestamp,
        createdAtRaw: record.createdAtRaw || null,
        sessionDuration: '—',
        device: record.device && record.device !== '—' ? record.device : '—',
        ip: record.ipAddress && record.ipAddress !== '—' ? record.ipAddress : '—',
        status: eventStatus(action, record.status),
        details: {
            Actor: record.user || '—',
            Role: record.role || '—',
            ...(record.userAgent ? { UserAgent: record.userAgent } : {}),
        },
    }
}

function buildLiveDirectory(users, auditRecords) {
    const latestByActor = new Map()
    for (const row of auditRecords) {
        const key = row.userId && row.userId !== '—' ? String(row.userId) : null
        if (!key) continue
        const prev = latestByActor.get(key)
        const ts = row.createdAtRaw ? Date.parse(row.createdAtRaw) : 0
        const prevTs = prev?.createdAtRaw ? Date.parse(prev.createdAtRaw) : 0
        if (!prev || ts >= prevTs) latestByActor.set(key, row)
    }

    return users.map((u) => {
        const last = latestByActor.get(String(u.id))
        return {
            id: String(u.id),
            name: u.name || u.email || 'Staff user',
            email: u.email || '',
            employeeId: u.employeeId || u.staffCode || String(u.id).slice(0, 8),
            role: u.role || '',
            roleLabel: u.roleLabel || u.role || 'Staff',
            department: u.department || 'Administration',
            designation: u.roleLabel || u.role || 'Staff',
            campus: u.details?.campusName || u.details?.campus || 'Campus',
            category: roleCategory(u.role, u.department),
            avatarColor: avatarColorFor(u.id),
            status: u.status || 'Active',
            lastActiveLabel: formatLastActive(last?.createdAtRaw),
            lastDevice: last?.device && last.device !== '—' ? last.device : '—',
            lastIp: last?.ipAddress && last.ipAddress !== '—' ? last.ipAddress : '—',
        }
    })
}

/** Mock timeline builder (used when live API is off). */
export const getUserTimelineEvents = (user) => {
    if (!user) return []

    const userEmail = (user.email || '').toLowerCase()
    const userName = (user.name || '').toLowerCase()
    const userRole = (user.role || '').toLowerCase()

    const loginLogs = LOGIN_HISTORY_LOGS.filter(
        (l) => (l.userEmail || '').toLowerCase() === userEmail || (l.user || '').toLowerCase().includes(userName),
    ).map((l) => ({
        id: l.id,
        category: 'Logins & Sessions',
        action: 'User Logged In',
        title: 'Logged into ERP Web Portal',
        description: `Successful authentication via credentials on ${l.device}`,
        module: 'Authentication & Session',
        target: l.sessionId,
        timestamp: l.timestamp,
        sessionDuration: '48 mins',
        device: l.device || '—',
        ip: l.ipAddress || '—',
        status: l.status || 'Success',
        details: { SessionId: l.sessionId, Location: l.location || '—' },
    }))

    const dataChangeLogs = DATA_CHANGES_LOGS.filter(
        (l) => (l.user || '').toLowerCase().includes(userName) || (l.userRole || '').toLowerCase().includes(userRole),
    ).map((l) => ({
        id: l.id,
        category: 'Form Submissions & Edits',
        action: 'Form Data Update',
        title: `Updated ${l.module} Record`,
        description: `Modified field "${l.fieldModified || 'General'}" on record #${l.recordId}`,
        module: l.module,
        target: l.recordId,
        timestamp: l.timestamp,
        sessionDuration: '—',
        device: l.device || '—',
        ip: l.ipAddress || '—',
        status: 'Success',
        details: { Before: l.previousValue || 'N/A', After: l.newValue || 'N/A' },
    }))

    const approvalLogs = APPROVAL_ACTIONS_LOGS.filter(
        (l) => (l.approver || '').toLowerCase().includes(userName) || (l.approverRole || '').toLowerCase().includes(userRole),
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
        device: l.device || '—',
        ip: l.ipAddress || '—',
        status: l.status || 'Approved',
        details: { Remarks: l.remarks || 'Sanctioned per standard operating procedure.' },
    }))

    return [...loginLogs, ...dataChangeLogs, ...approvalLogs].sort((a, b) =>
        (b.timestamp || '').localeCompare(a.timestamp || ''),
    )
}

export const ACTION_CATEGORIES = [
    'All Action Types',
    'Logins & Sessions',
    'Module Navigation',
    'Form Submissions & Edits',
    'Records Viewed & Updated',
    'Tasks & Approvals',
    'File & Document Actions',
]

const DIRECTORY_TABS = [
    'All',
    'Leadership & Executive',
    'Academics & Teaching',
    'Logistics & Campus Operations',
    'Finance & Administration',
]

export default function UserActivityTimeline({ initialUserId = null, onClose = null }) {
    const live = isLiveApiEnabled()
    const [selectedUserId, setSelectedUserId] = useState(initialUserId)
    const [userSearchTerm, setUserSearchTerm] = useState('')
    const [selectedCategoryTab, setSelectedCategoryTab] = useState('All')
    const [actionTypeFilter, setActionTypeFilter] = useState('All Action Types')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [eventSearchTerm, setEventSearchTerm] = useState('')
    const [directoryUsers, setDirectoryUsers] = useState(() =>
        live
            ? []
            : ENTERPRISE_USER_DIRECTORY.map((u) => ({
                  ...u,
                  lastActiveLabel: 'Today, 08:30 AM',
                  lastDevice: 'Chrome · Win 11',
                  lastIp: '—',
              })),
    )
    const [auditRecords, setAuditRecords] = useState([])
    const [loading, setLoading] = useState(live)
    const [loadError, setLoadError] = useState('')

    useEffect(() => {
        if (!live) return undefined
        let cancelled = false
        ;(async () => {
            setLoading(true)
            setLoadError('')
            const [usersRes, logsRes] = await Promise.all([
                listAdminUsers({ limit: 200 }),
                listAuditLogs('audit-logs'),
            ])
            if (cancelled) return
            if (!usersRes.success) {
                setLoadError(usersRes.error || 'Unable to load institutional users.')
                setDirectoryUsers([])
                setAuditRecords([])
                setLoading(false)
                return
            }
            const logs = logsRes.success && Array.isArray(logsRes.data) ? logsRes.data : []
            const users = Array.isArray(usersRes.data) ? usersRes.data : []
            setAuditRecords(logs)
            setDirectoryUsers(buildLiveDirectory(users, logs))
            setLoading(false)
        })()
        return () => {
            cancelled = true
        }
    }, [live])

    const selectedUser = useMemo(() => {
        if (!selectedUserId) return null
        return (
            directoryUsers.find((u) => u.id === selectedUserId || u.employeeId === selectedUserId) || null
        )
    }, [selectedUserId, directoryUsers])

    const filteredUsers = useMemo(() => {
        return directoryUsers.filter((u) => {
            if (userSearchTerm) {
                const q = userSearchTerm.toLowerCase()
                const matchName = (u.name || '').toLowerCase().includes(q)
                const matchEmail = (u.email || '').toLowerCase().includes(q)
                const matchRole = (u.roleLabel || u.role || '').toLowerCase().includes(q)
                const matchDept = (u.department || '').toLowerCase().includes(q)
                const matchEmpId = (u.employeeId || '').toLowerCase().includes(q)
                if (!matchName && !matchEmail && !matchRole && !matchDept && !matchEmpId) return false
            }
            if (selectedCategoryTab !== 'All' && u.category !== selectedCategoryTab) return false
            return true
        })
    }, [directoryUsers, userSearchTerm, selectedCategoryTab])

    const rawEvents = useMemo(() => {
        if (!selectedUser) return []
        if (!live) return getUserTimelineEvents(selectedUser)

        const uid = String(selectedUser.id)
        const email = (selectedUser.email || '').toLowerCase()
        const matched = auditRecords.filter((row) => {
            if (row.userId && String(row.userId) === uid) return true
            if (email && (row.userEmail || '').toLowerCase() === email) return true
            return false
        })
        return matched
            .map(mapAuditRecordToTimelineEvent)
            .sort((a, b) => {
                const ta = a.createdAtRaw ? Date.parse(a.createdAtRaw) : 0
                const tb = b.createdAtRaw ? Date.parse(b.createdAtRaw) : 0
                return tb - ta
            })
    }, [selectedUser, live, auditRecords])

    const filteredEvents = useMemo(() => {
        return rawEvents.filter((ev) => {
            if (actionTypeFilter !== 'All Action Types' && ev.category !== actionTypeFilter) return false
            if (eventSearchTerm) {
                const q = eventSearchTerm.toLowerCase()
                const matchTitle = (ev.title || '').toLowerCase().includes(q)
                const matchDesc = (ev.description || '').toLowerCase().includes(q)
                const matchModule = (ev.module || '').toLowerCase().includes(q)
                const matchTarget = (ev.target || '').toLowerCase().includes(q)
                const matchIp = (ev.ip || '').toLowerCase().includes(q)
                const matchDevice = (ev.device || '').toLowerCase().includes(q)
                if (!matchTitle && !matchDesc && !matchModule && !matchTarget && !matchIp && !matchDevice) {
                    return false
                }
            }
            if (dateFrom || dateTo) {
                const isoDay = ev.createdAtRaw
                    ? new Date(ev.createdAtRaw).toISOString().slice(0, 10)
                    : null
                if (isoDay) {
                    if (dateFrom && isoDay < dateFrom) return false
                    if (dateTo && isoDay > dateTo) return false
                } else if (ev.timestamp) {
                    const parts = ev.timestamp.split(' ')[0].split(/[-/]/)
                    if (parts.length === 3) {
                        const iso =
                            parts[0].length === 4
                                ? `${parts[0]}-${parts[1]}-${parts[2]}`
                                : `${parts[2]}-${parts[1]}-${parts[0]}`
                        if (dateFrom && iso < dateFrom) return false
                        if (dateTo && iso > dateTo) return false
                    }
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
            case 'Logout':
                return 'bg-blue-50 text-blue-700 border-blue-200'
            case 'Failed':
            case 'Rejected':
            case 'Blocked':
                return 'bg-rose-50 text-rose-700 border-rose-200'
            default:
                return 'bg-slate-50 text-slate-700 border-slate-200'
        }
    }

    if (!selectedUser) {
        return (
            <div className="space-y-5">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-slate-900">User Activity Timeline Directory</h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {directoryUsers.length} Institutional Users
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Select any user to inspect their end-to-end audit trail, session context, IP address, and device history.
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
                        {DIRECTORY_TABS.map((tab) => (
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
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                                            Loading institutional users…
                                        </td>
                                    </tr>
                                ) : loadError ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-10 text-center text-rose-500">
                                            {loadError}
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
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
                                                        {initialsFromName(u.name)}
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
                                                {u.campus || 'Campus'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-1.5 text-slate-700">
                                                    <Clock size={13} className="text-slate-400" />
                                                    <span>{u.lastActiveLabel || '—'}</span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                                    <Laptop size={10} /> {u.lastDevice || '—'}
                                                </p>
                                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                                    <Globe size={10} /> {u.lastIp || '—'}
                                                </p>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                                        (u.status || 'Active') === 'Active'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-slate-50 text-slate-600 border-slate-200'
                                                    }`}
                                                >
                                                    <span
                                                        className={`size-1.5 rounded-full ${
                                                            (u.status || 'Active') === 'Active'
                                                                ? 'bg-emerald-500'
                                                                : 'bg-slate-400'
                                                        }`}
                                                    />
                                                    {u.status || 'Active'}
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

    return (
        <div className="space-y-5 animate-fade-in">
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

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div
                            className="size-14 rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow-md shrink-0"
                            style={{ backgroundColor: selectedUser.avatarColor || '#3B82F6' }}
                        >
                            {initialsFromName(selectedUser.name)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-xl font-bold text-slate-900">{selectedUser.name}</h1>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    {selectedUser.roleLabel}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {selectedUser.department} · {selectedUser.designation} · #{selectedUser.employeeId} ·{' '}
                                {selectedUser.email}
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
                                Last IP / Device
                            </span>
                            <span className="text-xs font-bold text-slate-700 mt-0.5 block">
                                {selectedUser.lastIp || '—'}
                            </span>
                            <span className="text-[10px] text-slate-500">{selectedUser.lastDevice || '—'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div>
                        <label className="block text-slate-600 font-semibold mb-1">Search Events</label>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Action, IP, device, module..."
                                value={eventSearchTerm}
                                onChange={(e) => setEventSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white text-slate-800"
                            />
                        </div>
                    </div>

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

                    <div>
                        <label className="block text-slate-600 font-semibold mb-1">From Date</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white text-slate-800"
                        />
                    </div>

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
                        Showing {filteredEvents.length} matching event{filteredEvents.length !== 1 ? 's' : ''} out of{' '}
                        {rawEvents.length} total
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

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6">
                {filteredEvents.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                        <Clock size={36} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">No activity events found for the selected filters.</p>
                        <p className="text-xs text-slate-400 mt-1">
                            {live
                                ? 'New logins will appear here with IP address and device after the next sign-in.'
                                : 'Try resetting the date range or action type filter.'}
                        </p>
                    </div>
                ) : (
                    <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                        {filteredEvents.map((ev) => (
                            <div key={ev.id} className="relative group">
                                <div className="absolute -left-6 sm:-left-8 top-1.5 size-6 rounded-full bg-white border-2 border-slate-300 group-hover:border-blue-500 flex items-center justify-center transition shadow-2xs">
                                    <div className="size-2 rounded-full bg-slate-400 group-hover:bg-blue-600 transition" />
                                </div>

                                <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="p-1 rounded-md bg-slate-100">{getCategoryIcon(ev.category)}</span>
                                            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{ev.title}</h4>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                                {ev.module}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0">
                                            <Clock size={12} className="text-slate-400" />
                                            <span className="font-medium text-slate-700">{ev.timestamp}</span>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(ev.status)}`}
                                            >
                                                {ev.status}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-xs text-slate-600">{ev.description}</p>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <Laptop size={12} className="text-slate-400" /> Device: {ev.device}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Globe size={12} className="text-slate-400" /> IP: {ev.ip}
                                        </span>
                                        {ev.sessionDuration && ev.sessionDuration !== '—' && (
                                            <span className="flex items-center gap-1 text-slate-700 font-medium">
                                                <Clock size={12} className="text-blue-500" /> Duration:{' '}
                                                {ev.sessionDuration}
                                            </span>
                                        )}
                                        {ev.target && (
                                            <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                                ref: {ev.target}
                                            </span>
                                        )}
                                    </div>

                                    {ev.details && Object.keys(ev.details).length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {Object.entries(ev.details).map(([k, v]) => (
                                                <span
                                                    key={k}
                                                    className="text-[10px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded font-mono"
                                                >
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
