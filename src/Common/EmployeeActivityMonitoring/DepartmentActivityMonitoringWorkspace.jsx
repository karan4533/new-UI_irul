import React, { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
    Activity,
    Users,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Search,
    Filter,
    Download,
    Eye,
    ChevronRight,
    Building2,
    Layers,
    BarChart3,
    ArrowUpRight,
    Briefcase,
    Calendar,
    ChevronDown,
    User,
    ShieldAlert,
    ShieldCheck,
    CheckSquare,
    XCircle,
    MessageSquare,
    TrendingUp,
    RefreshCw,
    RotateCcw
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getProfileLabel } from '../../Pages/Authentication/profileOptions'
import { ROLES } from '../../constants/roles'
import {
    getAllEmployeeActivities,
    getHierarchicalActivityMonitoring,
    getEmployeeActivityHydrateError,
    hydrateEmployeeActivitiesFromAudit,
    reviewEmployeeActivity,
    summarizeLiveAuditActivities,
    ACTIVITY_TYPES
} from './employeeActivityMonitoringData'
import { ENTERPRISE_EMPLOYEES } from '../AttendanceAndLeave/attendanceLeaveData'
import { isLiveApiEnabled } from '../../services/api/tokenStore'

export default function DepartmentActivityMonitoringWorkspace({ defaultTab = 'activity-stream', roleOverride = null }) {
    const { role: authRole, email: authEmail, name: authName } = useAuth()
    const { tab } = useParams()
    const activeRole = roleOverride || authRole || 'director'
    const cleanRole = String(activeRole || '').trim().toLowerCase().replace(/[-_\s]/g, '')
    const roleLabel = getProfileLabel(activeRole)

    // Role Capabilities & Institutional Authorization
    // All roles can access monitoring scoped to their hierarchical visibility
    const isAuthorized = Boolean(cleanRole)
    const isSupervisoryRole = [
        'superadmin',
        'admin',
        'director',
        'md',
        'principal',
        'seniorprincipal',
        'jointdirector',
        'jointdirectorassistant',
        'prm',
        'hr',
        'coordinator',
        'academichead',
        'processauditor',
        'qualityauditor',
        'jointdirectoraudit',
        'canteenmanager',
        'transportmanager',
        'housekeepingmanager',
        'maintenancemanager',
        'itsupportmanager',
        'stationerystoremanager',
        'accounthead'
    ].includes(cleanRole)

    const targetTab = (tab || defaultTab) === 'overview' ? 'activity-stream' : (tab || defaultTab)
    // State
    const [activeTab, setActiveTab] = useState(targetTab)
    const [actionMessage, setActionMessage] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)

    // Drill-down & Multi-facet Filter State
    const [selectedDept, setSelectedDept] = useState('ALL')
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('ALL')
    const [roleFilter, setRoleFilter] = useState('ALL')
    const [dateFilter, setDateFilter] = useState('ALL')
    const [activityTypeFilter, setActivityTypeFilter] = useState('ALL')
    const [categoryFilter, setCategoryFilter] = useState('ALL')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [reviewFilter, setReviewFilter] = useState('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedActivityForReview, setSelectedActivityForReview] = useState(null)
    const [reviewDecision, setReviewDecision] = useState('Approved')
    const [reviewRemarks, setReviewRemarks] = useState('')
    const live = isLiveApiEnabled()
    const [liveLoading, setLiveLoading] = useState(Boolean(live))
    const [liveError, setLiveError] = useState('')

    useEffect(() => {
        if (!isLiveApiEnabled()) {
            setLiveLoading(false)
            return undefined
        }
        let cancelled = false
        setLiveLoading(true)
        setLiveError('')
        hydrateEmployeeActivitiesFromAudit({ force: true })
            .then(() => {
                if (cancelled) return
                setLiveLoading(false)
                setRefreshKey((k) => k + 1)
            })
            .catch((err) => {
                if (cancelled) return
                setLiveLoading(false)
                setLiveError(err?.message || getEmployeeActivityHydrateError() || 'Activity feed unavailable.')
                setRefreshKey((k) => k + 1)
            })
        return () => { cancelled = true }
    }, [])

    const notify = (msg) => {
        setActionMessage(msg)
        setTimeout(() => setActionMessage(''), 4000)
    }

    const handleResetFilters = () => {
        setSelectedDept('ALL')
        setSelectedEmployeeId('ALL')
        setRoleFilter('ALL')
        setDateFilter('ALL')
        setActivityTypeFilter('ALL')
        setCategoryFilter('ALL')
        setStatusFilter('ALL')
        setReviewFilter('ALL')
        setSearchQuery('')
        notify('Filters reset to default view.')
    }

    const currentUser = useMemo(() => {
        return (
            ENTERPRISE_EMPLOYEES.find((e) => (authEmail && e.email?.toLowerCase() === authEmail.toLowerCase()) || (authName && e.name === authName)) ||
            ENTERPRISE_EMPLOYEES.find((e) => (e.roleKey && e.roleKey.replace(/[-_\s]/g, '') === cleanRole)) ||
            null
        )
    }, [authEmail, authName, cleanRole])

    const currentUserId = currentUser?.employeeId || currentUser?.id || (cleanRole === 'admin' ? 'EMP-ADM-001' : '')

    // Dynamic Hierarchical Query
    const monitoringData = useMemo(() => {
        void refreshKey
        return getHierarchicalActivityMonitoring({
            viewerRole: activeRole,
            viewerEmployeeId: currentUserId,
            viewerName: authName || currentUser?.name || '',
            departmentFilter: selectedDept,
            employeeFilter: selectedEmployeeId,
            roleFilter,
            dateFilter,
            activityTypeFilter
        })
    }, [activeRole, currentUserId, authName, currentUser?.name, selectedDept, selectedEmployeeId, roleFilter, dateFilter, activityTypeFilter, refreshKey])

    const liveSummary = useMemo(() => {
        void refreshKey
        if (!live) return null
        return summarizeLiveAuditActivities(getAllEmployeeActivities())
    }, [live, refreshKey])

    // Tabs — Monitoring Overview is intentionally hidden; stream is the default live view.
    const availableTabs = useMemo(() => {
        const pendingCount = monitoringData.summary?.pendingReviewCount || 0
        const tabs = [
            { id: 'activity-stream', label: 'Team Activity Stream', icon: Activity }
        ]
        if (isSupervisoryRole && !live) {
            tabs.push(
                { id: 'pending-approvals', label: 'Pending HOD Approvals', icon: ShieldCheck, badge: pendingCount },
                { id: 'hierarchical-drilldown', label: 'Hierarchical Drill-Down', icon: Layers },
                { id: 'delayed-activities', label: 'Bottlenecks & Delays', icon: AlertTriangle }
            )
        }
        if (isSupervisoryRole && live) {
            tabs.push(
                { id: 'hierarchical-drilldown', label: 'By Module / Actor', icon: Layers }
            )
        }
        return tabs
    }, [isSupervisoryRole, live, monitoringData.summary?.pendingReviewCount])

    // Only sync from route/defaultTab — do NOT depend on availableTabs identity
    // (pending badge counts change after review/filter and would bounce users to Overview).
    useEffect(() => {
        const currentTarget = tab || defaultTab
        if (currentTarget === 'overview' || !availableTabs.some((t) => t.id === currentTarget)) {
            setActiveTab('activity-stream')
            return
        }
        setActiveTab(currentTarget)
    }, [tab, defaultTab, availableTabs])

    const handleCommitReview = (e) => {
        e.preventDefault()
        if (!selectedActivityForReview) return
        if (live) {
            notify('Live activity feed is read-only (campus audit trail). Review decisions stay on the originating module.')
            return
        }
        if (reviewDecision !== 'Approved' && !reviewRemarks.trim()) {
            notify('Remarks are mandatory when requesting revision.')
            return
        }

        try {
            reviewEmployeeActivity({
                activityId: selectedActivityForReview.id,
                decision: reviewDecision,
                reviewerName: authName || roleLabel,
                reviewerRole: activeRole,
                remarks: reviewRemarks.trim() || 'Reviewed and signed off by Department Overseer.'
            })
            notify(`Activity ${selectedActivityForReview.id} marked as '${reviewDecision}' successfully.`)
            setSelectedActivityForReview(null)
            setReviewDecision('Approved')
            setReviewRemarks('')
            setRefreshKey((k) => k + 1)
            // Keep user on Team Activity Stream (or current tab) after successful review.
            if (!tab) {
                setActiveTab((prev) => prev || 'activity-stream')
            }
        } catch (err) {
            notify(err.message || 'Failed to record review decision.')
        }
    }

    // Role-scoped available departments
    const availableDepartments = useMemo(() => {
        if (live && liveSummary?.departments?.length) {
            return liveSummary.departments
        }
        const set = new Set(ENTERPRISE_EMPLOYEES.map((e) => e.department))
        const allDepts = Array.from(set).sort()
        if (['superadmin', 'admin', 'director', 'md'].includes(cleanRole)) {
            return allDepts
        }
        if (['principal', 'seniorprincipal'].includes(cleanRole)) {
            return allDepts.filter((d) => d.includes('Academic') || d === 'Administration')
        }
        if (['coordinator', 'academichead'].includes(cleanRole)) {
            return allDepts.filter((d) => d.includes('Academic'))
        }
        const deptHeadMap = {
            'stationerystoremanager': 'Stores & Procurement',
            'transportmanager': 'Transport & Fleet Logistics',
            'itsupportmanager': 'IT Support & Systems',
            'gatekeepermanager': 'Campus Security & Access Control',
            'housekeepingmanager': 'Facilities & Campus Sanitation',
            'maintenancemanager': ['Facilities & Campus Sanitation', 'Physical Plant Maintenance'],
            'canteenmanager': 'Dining & Nutrition (Café)',
            'accounthead': 'Finance & Accounts',
            'hr': 'Human Resources (HR)',
            'admin': 'Administration',
            'jointdirector': 'Campus Operations',
            'jointdirectorassistant': 'Campus Operations',
            'jointdirectoraudit': 'Internal Audit',
            'qualityauditor': 'Internal Audit',
            'processauditor': 'Internal Audit'
        }
        const userDept = deptHeadMap[cleanRole]
        if (userDept) {
            if (Array.isArray(userDept)) {
                return allDepts.filter((d) => userDept.includes(d))
            }
            return allDepts.filter((d) => d === userDept)
        }
        return allDepts
    }, [cleanRole, live, liveSummary])

    // List of all 29 roles for multi-facet filtering
    const allRolesList = useMemo(() => {
        return Object.values(ROLES).map((r) => ({
            key: r,
            label: getProfileLabel(r)
        }))
    }, [])

    // Employees in currently selected department
    const departmentEmployees = useMemo(() => {
        if (live) {
            const source = liveSummary?.employees || []
            if (selectedDept === 'ALL') return source
            return source.filter((e) => e.department === selectedDept)
        }
        if (selectedDept === 'ALL') return ENTERPRISE_EMPLOYEES
        return ENTERPRISE_EMPLOYEES.filter((e) => e.department === selectedDept)
    }, [selectedDept, live, liveSummary])

    // Filtered Stream
    const filteredActivities = useMemo(() => {
        return (monitoringData.activities || []).filter((act) => {
            if (selectedDept !== 'ALL' && act.department !== selectedDept) return false
            if (selectedEmployeeId !== 'ALL' && act.employeeId !== selectedEmployeeId) return false
            if (roleFilter !== 'ALL') {
                const targetClean = roleFilter.toLowerCase().replace(/[-_\s]/g, '')
                const actRoleClean = (act.roleKey || act.role || '').toLowerCase().replace(/[-_\s]/g, '')
                if (actRoleClean !== targetClean && (act.role || '').toLowerCase() !== roleFilter.toLowerCase()) return false
            }
            if (activityTypeFilter !== 'ALL' && act.activityType !== activityTypeFilter) return false
            if (categoryFilter !== 'ALL' && act.category !== categoryFilter) return false
            if (statusFilter !== 'ALL' && act.status !== statusFilter) return false
            if (reviewFilter !== 'ALL' && act.reviewStatus !== reviewFilter) return false
            if (dateFilter !== 'ALL') {
                const todayStr = new Date().toLocaleDateString('en-GB')
                if (dateFilter === 'TODAY') {
                    if (act.date !== todayStr && !act.timestamp?.includes(todayStr)) return false
                } else if (dateFilter !== 'LAST_7_DAYS') {
                    if (act.date !== dateFilter && !act.timestamp?.includes(dateFilter)) return false
                }
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const match = `${act.employeeName} ${act.employeeId} ${act.activityTitle} ${act.role} ${act.activityType} ${act.department} ${act.details}`.toLowerCase()
                if (!match.includes(q)) return false
            }
            return true
        })
    }, [monitoringData.activities, selectedDept, selectedEmployeeId, roleFilter, activityTypeFilter, categoryFilter, statusFilter, reviewFilter, dateFilter, searchQuery])

    if (!isAuthorized) {
        return (
            <div className='p-6 md:p-12 min-h-[60vh] flex items-center justify-center'>
                <div className='max-w-lg w-full bg-white rounded-3xl border border-slate-200/90 p-8 text-center shadow-xl space-y-4'>
                    <div className='size-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs'>
                        <ShieldAlert size={30} />
                    </div>
                    <div>
                        <span className='inline-block text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200'>
                            Access Restricted
                        </span>
                        <h2 className='text-lg font-bold text-slate-900 mt-2'>Activity Monitoring Access Restricted</h2>
                        <p className='text-xs text-slate-500 mt-2 leading-relaxed'>
                            Department and team activity monitoring is restricted to supervisors, department heads, auditors, and executive administration. Your current user profile ({roleLabel}) does not have permission to inspect employee activity streams.
                        </p>
                    </div>
                    <div className='pt-3 border-t border-slate-100 text-[11px] text-slate-400'>
                        If you believe you require access to operational activity streams, contact your Department Head or System Administrator.
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className='space-y-6 p-4 md:p-6 bg-slate-50/50 min-h-screen'>
            <DataSourceIndicator
                status='LOCAL ONLY'
                detail='Activity Monitoring uses local demo activity records. There is no dedicated monitoring API SoT for this workspace.'
            />
            {/* Feedback Alert Toast */}
            {actionMessage && (
                <div className='flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-2xs'>
                    <CheckCircle2 size={16} className='text-emerald-600 shrink-0' />
                    <span>{actionMessage}</span>
                </div>
            )}
            {live && liveLoading ? (
                <div className='rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600'>
                    Loading campus activity from audit trail…
                </div>
            ) : null}
            {live && liveError ? (
                <div className='rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800'>
                    {liveError}
                </div>
            ) : null}
            {live && !liveLoading && !liveError ? (
                <div className='rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600'>
                    Showing live campus audit events ({getAllEmployeeActivities().length} records). Review actions stay read-only here.
                </div>
            ) : null}

            {/* Header: Title, Role Badge */}
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                <div className='flex items-center gap-3'>
                    <div className='p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs'>
                        <Activity size={22} />
                    </div>
                    <div>
                        <div className='flex items-center gap-2'>
                            <h1 className='text-2xl font-bold tracking-tight text-slate-900'>
                                Hierarchical Employee Activity Monitoring
                            </h1>
                            <span className='rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100'>
                                {roleLabel} • Transparency Portal
                            </span>
                        </div>
                        <p className='text-xs text-slate-500 mt-0.5'>
                            {live
                                ? 'Live campus audit trail from FastAPI /api/v1/audit-logs (logins, mutations, approvals, and system events).'
                                : 'Upward management visibility: cross-department operational trail (tasks, helpdesk tickets, store issues, and gate movements).'}
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-2.5'>
                    <button
                        type='button'
                        disabled={live && liveLoading}
                        onClick={() => {
                            if (!live) {
                                setRefreshKey((k) => k + 1)
                                notify('Activity telemetry synchronized.')
                                return
                            }
                            setLiveLoading(true)
                            setLiveError('')
                            hydrateEmployeeActivitiesFromAudit({ force: true })
                                .then((rows) => {
                                    setLiveLoading(false)
                                    setRefreshKey((k) => k + 1)
                                    notify(`Synced ${Array.isArray(rows) ? rows.length : 0} audit events from API.`)
                                })
                                .catch((err) => {
                                    setLiveLoading(false)
                                    setLiveError(err?.message || 'Sync failed.')
                                    notify(err?.message || 'Sync failed.')
                                })
                        }}
                        className='inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition disabled:opacity-50'
                    >
                        <RefreshCw size={14} className={`text-blue-600 ${live && liveLoading ? 'animate-spin' : ''}`} /> Sync Live Feed
                    </button>
                </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className='border-b border-slate-200/80 pb-px'>
                <div className='flex items-center gap-2 overflow-x-auto scrollbar-none'>
                    {availableTabs.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
                                    isActive
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <Icon size={14} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                                <span>{tab.label}</span>
                                {tab.id === 'delayed-activities' && (monitoringData?.summary?.delayedActivities ?? 0) > 0 && (
                                    <span className='rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0.2'>
                                        {monitoringData?.summary?.delayedActivities ?? 0} delayed
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ========================================================================= */}
            {/* TAB 1: OVERVIEW                                                           */}
            {/* ========================================================================= */}
            {activeTab === 'overview' && (
                <div className='space-y-6'>
                    {/* KPI Cards */}
                    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5'>
                        {live ? (
                            <>
                                <div className='rounded-[1.25rem] border border-blue-100 bg-[#E8F1FD]/60 p-4 shadow-2xs'>
                                    <div className='flex items-center justify-between'>
                                        <span className='text-xs font-semibold text-slate-600'>Audit events</span>
                                        <Activity size={16} className='text-blue-600' />
                                    </div>
                                    <div className='mt-2 flex items-baseline gap-2'>
                                        <span className='text-2xl font-bold text-slate-900'>{liveSummary?.totalEvents ?? 0}</span>
                                        <span className='text-[11px] font-medium text-blue-700'>From /audit-logs</span>
                                    </div>
                                </div>
                                <div className='rounded-[1.25rem] border border-emerald-100 bg-emerald-50/50 p-4 shadow-2xs'>
                                    <div className='flex items-center justify-between'>
                                        <span className='text-xs font-semibold text-slate-600'>Today</span>
                                        <Calendar size={16} className='text-emerald-600' />
                                    </div>
                                    <div className='mt-2 flex items-baseline gap-2'>
                                        <span className='text-2xl font-bold text-emerald-700'>{liveSummary?.todayEvents ?? 0}</span>
                                        <span className='text-[11px] font-medium text-emerald-800'>Events today</span>
                                    </div>
                                </div>
                                <div className='rounded-[1.25rem] border border-amber-100 bg-amber-50/50 p-4 shadow-2xs'>
                                    <div className='flex items-center justify-between'>
                                        <span className='text-xs font-semibold text-slate-600'>Auth events</span>
                                        <ShieldCheck size={16} className='text-amber-600' />
                                    </div>
                                    <div className='mt-2 flex items-baseline gap-2'>
                                        <span className='text-2xl font-bold text-amber-700'>{liveSummary?.authEvents ?? 0}</span>
                                        <span className='text-[11px] font-medium text-amber-800'>Login / OTP / Logout</span>
                                    </div>
                                </div>
                                <div className='rounded-[1.25rem] border border-indigo-100 bg-indigo-50/50 p-4 shadow-2xs'>
                                    <div className='flex items-center justify-between'>
                                        <span className='text-xs font-semibold text-slate-600'>Unique actors</span>
                                        <Users size={16} className='text-indigo-600' />
                                    </div>
                                    <div className='mt-2 flex items-baseline gap-2'>
                                        <span className='text-2xl font-bold text-indigo-700'>{liveSummary?.uniqueActors ?? 0}</span>
                                        <span className='text-[11px] font-medium text-indigo-800'>Staff in trail</span>
                                    </div>
                                </div>
                                <div className='rounded-[1.25rem] border border-rose-100 bg-rose-50/50 p-4 shadow-2xs'>
                                    <div className='flex items-center justify-between'>
                                        <span className='text-xs font-semibold text-slate-600'>Failed / blocked</span>
                                        <AlertTriangle size={16} className='text-rose-600' />
                                    </div>
                                    <div className='mt-2 flex items-baseline gap-2'>
                                        <span className='text-2xl font-bold text-rose-600'>{liveSummary?.failedEvents ?? 0}</span>
                                        <span className='text-[11px] font-medium text-rose-700'>Auth / deny events</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                        <div className='rounded-[1.25rem] border border-blue-100 bg-[#E8F1FD]/60 p-4 shadow-2xs'>
                            <div className='flex items-center justify-between'>
                                <span className='text-xs font-semibold text-slate-600'>Logged Activities</span>
                                <Activity size={16} className='text-blue-600' />
                            </div>
                            <div className='mt-2 flex items-baseline gap-2'>
                                <span className='text-2xl font-bold text-slate-900'>{monitoringData?.summary?.totalActivities ?? 0}</span>
                                <span className='text-[11px] font-medium text-blue-700'>Operational Events</span>
                            </div>
                        </div>

                        <div className='rounded-[1.25rem] border border-emerald-100 bg-emerald-50/50 p-4 shadow-2xs'>
                            <div className='flex items-center justify-between'>
                                <span className='text-xs font-semibold text-slate-600'>Completed Tasks</span>
                                <CheckCircle2 size={16} className='text-emerald-600' />
                            </div>
                            <div className='mt-2 flex items-baseline gap-2'>
                                <span className='text-2xl font-bold text-emerald-700'>{monitoringData?.summary?.completedTasks ?? monitoringData?.summary?.completedActivities ?? 0}</span>
                                <span className='text-[11px] font-medium text-emerald-800'>Verified Deliverables</span>
                            </div>
                        </div>

                        <div className='rounded-[1.25rem] border border-amber-100 bg-amber-50/50 p-4 shadow-2xs'>
                            <div className='flex items-center justify-between'>
                                <span className='text-xs font-semibold text-slate-600'>Pending / Active Tasks</span>
                                <Clock size={16} className='text-amber-600' />
                            </div>
                            <div className='mt-2 flex items-baseline gap-2'>
                                <span className='text-2xl font-bold text-amber-700'>{monitoringData?.summary?.pendingTasks ?? monitoringData?.summary?.inProgressActivities ?? 0}</span>
                                <span className='text-[11px] font-medium text-amber-800'>In Execution</span>
                            </div>
                        </div>

                        <div className='rounded-[1.25rem] border border-indigo-100 bg-indigo-50/50 p-4 shadow-2xs'>
                            <div className='flex items-center justify-between'>
                                <span className='text-xs font-semibold text-slate-600'>Tickets Closed</span>
                                <CheckCircle2 size={16} className='text-indigo-600' />
                            </div>
                            <div className='mt-2 flex items-baseline gap-2'>
                                <span className='text-2xl font-bold text-indigo-700'>{monitoringData?.summary?.ticketsClosed ?? monitoringData?.summary?.completedActivities ?? 0}</span>
                                <span className='text-[11px] font-medium text-indigo-800'>CSAT Confirmed</span>
                            </div>
                        </div>

                        <div className='rounded-[1.25rem] border border-rose-100 bg-rose-50/50 p-4 shadow-2xs'>
                            <div className='flex items-center justify-between'>
                                <span className='text-xs font-semibold text-slate-600'>Delayed Activities</span>
                                <AlertTriangle size={16} className='text-rose-600' />
                            </div>
                            <div className='mt-2 flex items-baseline gap-2'>
                                <span className='text-2xl font-bold text-rose-600'>{monitoringData?.summary?.delayedActivities ?? 0}</span>
                                <span className='text-[11px] font-medium text-rose-700'>Overdue Actions</span>
                            </div>
                        </div>
                            </>
                        )}
                    </div>

                    {/* Department Productivity Breakdown */}
                    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                        {/* Department Distribution */}
                        <div className='lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs'>
                            <div className='flex items-center justify-between mb-4 border-b border-slate-100 pb-3'>
                                <div>
                                    <h3 className='text-sm font-semibold text-slate-900'>
                                        {live ? 'Events by module' : 'Department Operational Workload'}
                                    </h3>
                                    <p className='text-xs text-slate-500'>
                                        {live
                                            ? 'Grouped by audit entity / module from the live trail'
                                            : 'Completed vs Pending action items across school divisions'}
                                    </p>
                                </div>
                            </div>

                            <div className='space-y-3'>
                                {Object.entries(
                                    live
                                        ? (liveSummary?.moduleBreakdown || {})
                                        : (monitoringData?.summary?.departmentBreakdown || {})
                                ).map(([deptName, stats]) => {
                                    const total = stats?.total ?? stats?.count ?? 0
                                    const completed = stats?.completed ?? 0
                                    const delayed = live ? (stats?.failed ?? 0) : (stats?.delayed ?? 0)
                                    const completedPercent = total > 0 ? (completed / total) * 100 : 0
                                    const delayedPercent = total > 0 ? (delayed / total) * 100 : 0

                                    return (
                                        <div key={deptName} className='rounded-xl border border-slate-100 p-3 bg-slate-50/50 space-y-2'>
                                            <div className='flex items-center justify-between text-xs'>
                                                <span className='font-bold text-slate-900'>{deptName}</span>
                                                <span className='font-mono font-semibold text-slate-600'>{total} {live ? 'Events' : 'Total Actions'}</span>
                                            </div>
                                            <div className='flex items-center gap-2'>
                                                <div className='h-2 flex-1 rounded-full bg-slate-200 overflow-hidden flex'>
                                                    <div
                                                        className='bg-emerald-500 h-full'
                                                        style={{ width: `${completedPercent}%` }}
                                                    />
                                                    <div
                                                        className='bg-rose-500 h-full'
                                                        style={{ width: `${delayedPercent}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className='flex items-center justify-between text-[11px] text-slate-500'>
                                                <span className='text-emerald-700 font-semibold'>{completed} {live ? 'Recorded' : 'Completed'}</span>
                                                <span className='text-rose-700 font-semibold'>{delayed} {live ? 'Failed' : 'Delayed'}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                                {live && Object.keys(liveSummary?.moduleBreakdown || {}).length === 0 ? (
                                    <p className='text-sm text-slate-500 py-6 text-center'>No audit events yet for this campus.</p>
                                ) : null}
                            </div>
                        </div>

                        {/* Quick Filter Drilldown Card */}
                        <div className='rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4'>
                            <div>
                                <h3 className='text-sm font-semibold text-slate-900'>Hierarchical Filter</h3>
                                <p className='text-xs text-slate-500'>Scope monitoring view to specific team or individual</p>
                            </div>

                            <div className='space-y-3 text-xs'>
                                <div>
                                    <label className='font-semibold text-slate-700 block mb-1'>Select Department</label>
                                    <select
                                        value={selectedDept}
                                        onChange={(e) => {
                                            setSelectedDept(e.target.value)
                                            setSelectedEmployeeId('ALL')
                                        }}
                                        className='w-full rounded-xl border border-slate-200 p-2'
                                    >
                                        <option value='ALL'>All Campus Departments</option>
                                        {availableDepartments.map((dept) => (
                                            <option key={dept} value={dept}>
                                                {dept}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className='font-semibold text-slate-700 block mb-1'>Select Individual Employee</label>
                                    <select
                                        value={selectedEmployeeId}
                                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                        className='w-full rounded-xl border border-slate-200 p-2'
                                    >
                                        <option value='ALL'>All Staff Members in Selection</option>
                                        {departmentEmployees.map((emp) => (
                                            <option key={emp.employeeId} value={emp.employeeId}>
                                                {emp.name || emp.employeeName} ({emp.employeeId}{emp.designation ? ` - ${emp.designation}` : ''})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    onClick={() => setActiveTab('hierarchical-drilldown')}
                                    className='w-full rounded-xl bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700 transition'
                                >
                                    Open Detailed Dossier →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: TEAM ACTIVITY STREAM                                               */}
            {/* ========================================================================= */}
            {activeTab === 'activity-stream' && (
                <div className='space-y-4'>
                    {/* Multi-Facet Filters Bar */}
                    <div className='rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3'>
                        <div className='flex flex-col md:flex-row md:items-center justify-between gap-3'>
                            <div className='relative flex-1 min-w-[240px]'>
                                <Search className='absolute left-3 top-2.5 text-slate-400' size={14} />
                                <input
                                    type='text'
                                    placeholder='Search employee name, ID, role, task title, action details...'
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className='w-full rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden'
                                />
                            </div>

                            <div className='flex items-center gap-2 flex-wrap text-xs text-slate-600'>
                                <span className='font-semibold text-slate-500 text-[11px] uppercase tracking-wider'>
                                    Showing {filteredActivities.length} activities
                                </span>
                                {(selectedDept !== 'ALL' || selectedEmployeeId !== 'ALL' || roleFilter !== 'ALL' || dateFilter !== 'ALL' || activityTypeFilter !== 'ALL' || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || reviewFilter !== 'ALL' || searchQuery) && (
                                    <button
                                        type='button'
                                        onClick={handleResetFilters}
                                        className='inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 text-xs font-semibold transition'
                                        title='Clear all filters'
                                    >
                                        <RotateCcw size={12} /> Reset Filters
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Multi-Facet Filter Controls Grid */}
                        <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1 border-t border-slate-100'>
                            {/* 1. Department Filter */}
                            <div>
                                <label className='block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1'>Department</label>
                                <select
                                    value={selectedDept}
                                    onChange={(e) => {
                                        setSelectedDept(e.target.value)
                                        setSelectedEmployeeId('ALL')
                                    }}
                                    className='w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs bg-white text-slate-800 focus:border-blue-500'
                                >
                                    <option value='ALL'>All Departments</option>
                                    {availableDepartments.map((dept) => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 2. User / Employee Filter */}
                            <div>
                                <label className='block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1'>Employee / User</label>
                                <select
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    className='w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs bg-white text-slate-800 focus:border-blue-500'
                                >
                                    <option value='ALL'>All Staff Members</option>
                                    {departmentEmployees.map((emp) => (
                                        <option key={emp.employeeId} value={emp.employeeId}>
                                            {emp.name} ({emp.designation})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 3. Role Filter (All 29 Roles) */}
                            <div>
                                <label className='block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1'>Role (29 Roles)</label>
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className='w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs bg-white text-slate-800 focus:border-blue-500'
                                >
                                    <option value='ALL'>All Roles</option>
                                    {allRolesList.map((r) => (
                                        <option key={r.key} value={r.key}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 4. Date / Date-time Filter */}
                            <div>
                                <label className='block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1'>Date / Timeline</label>
                                <select
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className='w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs bg-white text-slate-800 focus:border-blue-500'
                                >
                                    <option value='ALL'>All Dates</option>
                                    <option value='TODAY'>Today</option>
                                    <option value='LAST_7_DAYS'>Last 7 Days</option>
                                    <option value='31-10-2026'>31 Oct 2026</option>
                                    <option value='30-10-2026'>30 Oct 2026</option>
                                </select>
                            </div>

                            {/* 5. Activity Type Filter */}
                            <div>
                                <label className='block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1'>Activity Type</label>
                                <select
                                    value={activityTypeFilter}
                                    onChange={(e) => setActivityTypeFilter(e.target.value)}
                                    className='w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs bg-white text-slate-800 focus:border-blue-500'
                                >
                                    <option value='ALL'>All Activity Types</option>
                                    {ACTIVITY_TYPES.map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 6. Review & Status Stage Filter */}
                            <div>
                                <label className='block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1'>Review Stage</label>
                                <select
                                    value={reviewFilter}
                                    onChange={(e) => setReviewFilter(e.target.value)}
                                    className='w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs bg-white text-slate-800 focus:border-blue-500'
                                >
                                    <option value='ALL'>All Review Stages</option>
                                    <option value='Pending Approval'>Pending Approval</option>
                                    <option value='Approved'>Approved by HOD</option>
                                    <option value='Needs Revision'>Needs Revision</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className='rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden'>
                        <div className='overflow-x-auto'>
                            <table className='w-full text-left text-xs'>
                                <thead>
                                    <tr className='border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500'>
                                        <th className='py-3 px-4'>Date & Time</th>
                                        <th className='py-3 px-4'>Employee & Role</th>
                                        <th className='py-3 px-4'>Department</th>
                                        <th className='py-3 px-4'>Activity Type</th>
                                        <th className='py-3 px-4'>Category</th>
                                        <th className='py-3 px-4'>Activity Description</th>
                                        <th className='py-3 px-4 text-center'>Task Status</th>
                                        <th className='py-3 px-4 text-center'>HOD Review</th>
                                        <th className='py-3 px-4 text-right'>Action</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-slate-100 text-slate-700'>
                                    {filteredActivities.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className='py-8 text-center text-slate-400'>
                                                No activity records match the selected multi-facet filter criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredActivities.map((act) => (
                                            <tr key={act.id} className='hover:bg-slate-50/70'>
                                                <td className='py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap'>{act.timestamp}</td>
                                                <td className='py-3 px-4'>
                                                    <div className='font-semibold text-slate-900'>{act.employeeName}</div>
                                                    <div className='text-[11px] text-slate-400'>{act.employeeId} • {act.role}</div>
                                                </td>
                                                <td className='py-3 px-4 text-slate-600'>{act.department}</td>
                                                <td className='py-3 px-4'>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                        act.activityType === 'Login / Logout'
                                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                            : act.activityType === 'Page Visit'
                                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                            : act.activityType === 'Form Submit'
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : act.activityType === 'Print Action'
                                                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                            : act.activityType === 'Download / Export'
                                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                            : act.activityType === 'Upload Action'
                                                            ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                                            : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {act.activityType || 'Operational'}
                                                    </span>
                                                </td>
                                                <td className='py-3 px-4 font-medium text-slate-800'>{act.category}</td>
                                                <td className='py-3 px-4'>
                                                    <div className='font-semibold text-slate-900'>{act.activityTitle}</div>
                                                    <div className='text-[11px] text-slate-500'>{act.details}</div>
                                                </td>
                                                <td className='py-3 px-4 text-center'>
                                                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                                        act.status === 'Completed'
                                                            ? 'bg-emerald-50 text-emerald-700'
                                                            : act.status === 'Delayed'
                                                            ? 'bg-rose-100 text-rose-800'
                                                            : 'bg-amber-50 text-amber-700'
                                                    }`}>
                                                        {act.status}
                                                    </span>
                                                </td>
                                                <td className='py-3 px-4 text-center'>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                        act.reviewStatus === 'Approved'
                                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                            : act.reviewStatus === 'Needs Revision'
                                                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                                                    }`}>
                                                        {act.reviewStatus || 'Pending Approval'}
                                                    </span>
                                                    {act.reviewedBy && (
                                                        <div className='text-[10px] text-slate-400 mt-0.5'>by {act.reviewedBy}</div>
                                                    )}
                                                </td>
                                                <td className='py-3 px-4 text-right whitespace-nowrap'>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedActivityForReview(act)
                                                            setReviewDecision(act.reviewStatus === 'Needs Revision' ? 'Needs Revision' : 'Approved')
                                                            setReviewRemarks(act.reviewRemarks || '')
                                                        }}
                                                        className='inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition'
                                                    >
                                                        <ShieldCheck size={13} />
                                                        {act.reviewStatus === 'Approved' ? 'View Sign-Off' : 'Review & Sign-Off'}
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
            )}

            
            {/* ========================================================================= */}
            {/* TAB: PENDING HOD APPROVALS                                                */}
            {/* ========================================================================= */}
            {activeTab === 'pending-approvals' && (
                <div className='space-y-4'>
                    <div className='rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-xs flex items-center justify-between'>
                        <div>
                            <h3 className='text-sm font-bold text-amber-950'>Department Overseer Pending Review Queue</h3>
                            <p className='text-xs text-amber-800'>
                                Subordinates have logged daily operational tasks awaiting managerial sign-off and performance point validation.
                            </p>
                        </div>
                        <span className='rounded-full bg-amber-600 px-3 py-1 text-xs font-bold text-white shadow-xs'>
                            {filteredActivities.filter((a) => a.reviewStatus === 'Pending Approval').length} Pending Review
                        </span>
                    </div>

                    <div className='rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden'>
                        <div className='overflow-x-auto'>
                            <table className='w-full text-left text-xs'>
                                <thead>
                                    <tr className='border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500'>
                                        <th className='py-3 px-4'>Date & Time</th>
                                        <th className='py-3 px-4'>Employee & Department</th>
                                        <th className='py-3 px-4'>Activity Description</th>
                                        <th className='py-3 px-4'>Module & Evidence</th>
                                        <th className='py-3 px-4 text-right'>Action</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-slate-100 text-slate-700'>
                                    {filteredActivities.filter((a) => a.reviewStatus === 'Pending Approval').length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className='py-8 text-center text-xs text-slate-400'>
                                                ✓ All logged activities in this scope have been reviewed and approved!
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredActivities
                                            .filter((a) => a.reviewStatus === 'Pending Approval')
                                            .map((act) => (
                                                <tr key={act.id} className='hover:bg-amber-50/40 transition'>
                                                    <td className='py-3 px-4 font-mono text-[11px] text-slate-600'>{act.timestamp}</td>
                                                    <td className='py-3 px-4'>
                                                        <div className='font-semibold text-slate-900'>{act.employeeName}</div>
                                                        <div className='text-[11px] text-slate-500'>{act.employeeId} · {act.department}</div>
                                                    </td>
                                                    <td className='py-3 px-4'>
                                                        <div className='font-semibold text-slate-900'>{act.activityTitle}</div>
                                                        <div className='text-[11px] text-slate-500'>{act.details}</div>
                                                    </td>
                                                    <td className='py-3 px-4'>
                                                        <span className='rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700'>
                                                            {act.category}
                                                        </span>
                                                        {act.evidence && (
                                                            <div className='text-[10px] text-blue-600 mt-0.5'>📎 {act.evidence}</div>
                                                        )}
                                                    </td>
                                                    <td className='py-3 px-4 text-right'>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedActivityForReview(act)
                                                                setReviewDecision('Approved')
                                                                setReviewRemarks('Reviewed and endorsed.')
                                                            }}
                                                            className='rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition'
                                                        >
                                                            Sign-Off Activity ✍️
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
            )}

            {/* ========================================================================= */}
            {/* TAB 3: HIERARCHICAL DRILL-DOWN                                            */}
            {/* ========================================================================= */}
            {activeTab === 'hierarchical-drilldown' && (
                <div className='space-y-4'>
                    <div className='rounded-2xl border border-blue-100 bg-[#E8F1FD]/40 p-4 shadow-xs flex items-center justify-between'>
                        <div>
                            <h3 className='text-sm font-bold text-blue-950'>Organizational Transparency Dossier</h3>
                            <p className='text-xs text-blue-800'>
                                Drill down from School Board level down to individual team member operational output.
                            </p>
                        </div>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        {/* Selected Individual Card */}
                        {departmentEmployees.slice(0, 6).map((emp) => {
                            const empActivities = (monitoringData?.activities || []).filter((a) => a.employeeId === emp.employeeId)
                            const completedCount = empActivities.filter((a) => a.status === 'Completed').length
                            return (
                                <div key={emp.employeeId} className='rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3'>
                                    <div className='flex items-center justify-between'>
                                        <div>
                                            <span className='font-mono text-xs font-bold text-blue-600'>{emp.employeeId}</span>
                                            <h4 className='text-sm font-bold text-slate-900'>{emp.name}</h4>
                                            <p className='text-xs text-slate-500'>{emp.designation}</p>
                                        </div>
                                        <span className='rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600'>
                                            {emp.department}
                                        </span>
                                    </div>

                                    <div className='rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs space-y-1.5'>
                                        <div className='flex items-center justify-between'>
                                            <span className='text-slate-500'>Active Deliverables:</span>
                                            <span className='font-bold text-slate-900'>{empActivities.length} Actions</span>
                                        </div>
                                        <div className='flex items-center justify-between'>
                                            <span className='text-slate-500'>Completion Rate:</span>
                                            <span className='font-bold text-emerald-700'>
                                                {empActivities.length > 0 ? Math.round((completedCount / empActivities.length) * 100) : 100}%
                                            </span>
                                        </div>
                                    </div>

                                    <div className='space-y-1 text-xs'>
                                        <div className='font-semibold text-slate-700 text-[11px]'>Recent Action Items:</div>
                                        {empActivities.length === 0 ? (
                                            <div className='text-[11px] text-slate-400'>Standard daily operational cadence.</div>
                                        ) : (
                                            empActivities.slice(0, 2).map((a) => (
                                                <div key={a.id} className='text-[11px] text-slate-600 truncate'>
                                                    • {a.activityTitle} ({a.status})
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: DELAYED ACTIVITIES & BOTTLENECKS                                    */}
            {/* ========================================================================= */}
            {activeTab === 'delayed-activities' && (
                <div className='space-y-4'>
                    <div className='rounded-2xl border border-rose-100 bg-rose-50/40 p-4 shadow-xs flex items-center justify-between'>
                        <div>
                            <h3 className='text-sm font-bold text-rose-950'>Delayed Activities & Operational Bottlenecks</h3>
                            <p className='text-xs text-rose-800'>
                                Escalations requiring supervisory intervention to unblock workflow deadlines.
                            </p>
                        </div>
                    </div>

                    <div className='space-y-3'>
                        {(monitoringData?.activities || []).filter((a) => a.status === 'Delayed').map((act) => (
                            <div key={act.id} className='rounded-2xl border border-rose-200 bg-white p-4 shadow-xs flex items-center justify-between'>
                                <div className='space-y-1'>
                                    <div className='flex items-center gap-2'>
                                        <span className='rounded bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5'>
                                            Delayed
                                        </span>
                                        <span className='font-bold text-sm text-slate-900'>{act.activityTitle}</span>
                                    </div>
                                    <div className='text-xs text-slate-600'>
                                        <b>Owner:</b> {act.employeeName} ({act.department}) • <b>Category:</b> {act.category}
                                    </div>
                                    <div className='text-[11px] text-slate-500'>{act.details}</div>
                                </div>
                                <button
                                    onClick={() => notify(`Supervisory reminder dispatched to ${act.employeeName}.`)}
                                    className='rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700'
                                >
                                    Escalate Reminder
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* REVIEW MODAL */}
            {selectedActivityForReview && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
                    <div className='bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4'>
                        <div className='flex items-center justify-between border-b pb-3'>
                            <div className='flex items-center gap-2'>
                                <ShieldCheck className='text-blue-600' size={20} />
                                <h3 className='text-sm font-bold text-slate-800'>Supervisory Activity Review</h3>
                            </div>
                            <button
                                type='button'
                                onClick={() => setSelectedActivityForReview(null)}
                                className='p-1 text-slate-400 hover:text-slate-600 rounded-lg'
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <div className='bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1.5'>
                            <div><strong className='text-slate-700'>Activity:</strong> {selectedActivityForReview.activityTitle}</div>
                            <div><strong className='text-slate-700'>Owner:</strong> {selectedActivityForReview.employeeName} ({selectedActivityForReview.department})</div>
                            <div><strong className='text-slate-700'>Category:</strong> {selectedActivityForReview.category}</div>
                            <div><strong className='text-slate-700'>Details:</strong> {selectedActivityForReview.details}</div>
                        </div>

                        <form onSubmit={handleCommitReview} className='space-y-3 text-xs'>
                            <div>
                                <label className='font-semibold text-slate-700 block mb-1'>Review Decision</label>
                                <select
                                    value={reviewDecision}
                                    onChange={(e) => setReviewDecision(e.target.value)}
                                    className='w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-blue-600'
                                >
                                    <option value='Approved'>Approved (Sign Off)</option>
                                    <option value='Needs Revision'>Needs Revision (Request Rework)</option>
                                    <option value='Escalated'>Escalate to Executive Leadership</option>
                                </select>
                            </div>

                            <div>
                                <label className='font-semibold text-slate-700 block mb-1'>
                                    Supervisory Remarks / Feedback {reviewDecision !== 'Approved' && <span className='text-rose-500'>*</span>}
                                </label>
                                <textarea
                                    rows={3}
                                    value={reviewRemarks}
                                    onChange={(e) => setReviewRemarks(e.target.value)}
                                    placeholder='Provide feedback, directives, or approval comments...'
                                    className='w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-blue-600'
                                />
                            </div>

                            <div className='flex items-center justify-end gap-2 pt-2 border-t'>
                                <button
                                    type='button'
                                    onClick={() => setSelectedActivityForReview(null)}
                                    className='px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='submit'
                                    className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs'
                                >
                                    Submit Decision
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

