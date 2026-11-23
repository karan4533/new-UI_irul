import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
    Bell,
    Check,
    CheckCheck,
    Search,
    Info,
    CalendarDays,
    BookOpen,
    DollarSign,
    PartyPopper,
    ClipboardCheck,
    ShieldAlert,
    ListChecks,
} from 'lucide-react'
import {
    STAFF_NOTIFICATIONS,
    staffTypeBadgeColor,
} from '../../Notifications/staffNotificationsData'
import { isLiveApiEnabled } from '../../../services/api/tokenStore'
import {
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from '../../../services/api/notificationsApiService'

const STORAGE_KEY = 'schoolerp-notifications-v2'

const TYPE_ICONS = {
    Exam: BookOpen,
    Event: PartyPopper,
    Holiday: CalendarDays,
    Payment: DollarSign,
    Announcement: Info,
    General: Bell,
    Leave: CalendarDays,
    Approval: ClipboardCheck,
    Escalation: ShieldAlert,
    Task: ListChecks,
    Ops: Bell,
    Duty: ClipboardCheck,
}

function loadMockNotifications() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
    } catch {
        /* ignore */
    }
    return STAFF_NOTIFICATIONS
}

const UserNotifications = () => {
    const live = isLiveApiEnabled()
    const [open, setOpen] = useState(false)
    const [activeFilter, setActiveFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')
    const [notifications, setNotifications] = useState(() => (live ? [] : loadMockNotifications()))
    const dropdownRef = useRef(null)

    const loadLive = useCallback(async () => {
        if (!isLiveApiEnabled()) return
        setLoading(true)
        setError('')
        const res = await listNotifications()
        if (!res.success) {
            setNotifications([])
            setError(res.error || 'Unable to load notifications.')
            setLoading(false)
            return
        }
        setNotifications(Array.isArray(res.data) ? res.data : [])
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!live) return undefined
        loadLive()
        const timer = window.setInterval(loadLive, 60_000)
        return () => window.clearInterval(timer)
    }, [live, loadLive])

    useEffect(() => {
        if (live && open) loadLive()
    }, [live, open, loadLive])

    const unreadCount = useMemo(
        () => notifications.filter((n) => !n.isRead).length,
        [notifications],
    )

    const persistMock = (next) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
            /* ignore */
        }
    }

    const markAsRead = async (id) => {
        if (!id) return
        setNotifications((prev) => {
            const next = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
            if (!live) persistMock(next)
            return next
        })
        if (!live) return
        const res = await markNotificationRead(id)
        if (!res.success) {
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)),
            )
        }
    }

    const markAllAsRead = async () => {
        const snapshot = notifications
        setNotifications((prev) => {
            const next = prev.map((n) => ({ ...n, isRead: true }))
            if (!live) persistMock(next)
            return next
        })
        if (!live) return
        const res = await markAllNotificationsRead(snapshot)
        if (!res.success) loadLive()
    }

    const toggleDropdown = () => setOpen((prev) => !prev)

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && open) setOpen(false)
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open])

    const filteredNotifications = useMemo(() => {
        return notifications.filter((item) => {
            if (activeFilter === 'unread' && item.isRead) return false
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase()
                const matchesTitle = item.title?.toLowerCase().includes(q)
                const matchesMessage = item.message?.toLowerCase().includes(q)
                const matchesType = item.type?.toLowerCase().includes(q)
                const matchesPoster = item.postedBy?.toLowerCase().includes(q)
                if (!matchesTitle && !matchesMessage && !matchesType && !matchesPoster) return false
            }
            return true
        })
    }, [notifications, activeFilter, searchQuery])

    return (
        <div className='relative' ref={dropdownRef}>
            <button
                type='button'
                onClick={toggleDropdown}
                aria-label='View notifications'
                aria-expanded={open}
                className={`relative inline-flex size-8 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                    open
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
                title='Notifications'
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className='absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-xs'>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className='fixed inset-x-3 top-[4.75rem] sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-[420px] md:w-[460px] rounded-2xl border border-slate-200/90 bg-white shadow-2xl z-50 overflow-hidden flex flex-col max-h-[calc(100vh-6rem)] sm:max-h-[580px] animate-scaleUp text-xs font-inter'>
                    <div className='flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50/80'>
                        <div className='flex items-center gap-2.5'>
                            <div className='flex size-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700'>
                                <Bell size={16} />
                            </div>
                            <div>
                                <h3 className='font-bold text-slate-900 text-sm'>Notifications</h3>
                                <p className='text-[11px] text-slate-500'>
                                    {loading
                                        ? 'Refreshing…'
                                        : `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`}
                                </p>
                            </div>
                        </div>

                        {unreadCount > 0 && (
                            <button
                                type='button'
                                onClick={markAllAsRead}
                                className='inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors shadow-2xs cursor-pointer'
                            >
                                <CheckCheck size={14} /> Mark All as Read
                            </button>
                        )}
                    </div>

                    <div className='p-3 border-b border-slate-100 bg-white flex flex-col gap-2'>
                        <div className='flex items-center justify-between gap-2'>
                            <div className='flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl'>
                                <button
                                    type='button'
                                    onClick={() => setActiveFilter('all')}
                                    className={`px-3 py-1 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                                        activeFilter === 'all'
                                            ? 'bg-white text-slate-900 shadow-2xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    All ({notifications.length})
                                </button>
                                <button
                                    type='button'
                                    onClick={() => setActiveFilter('unread')}
                                    className={`px-3 py-1 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                                        activeFilter === 'unread'
                                            ? 'bg-white text-blue-700 shadow-2xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Unread ({unreadCount})
                                </button>
                            </div>

                            <div className='relative flex-1 max-w-[180px]'>
                                <Search size={13} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400' />
                                <input
                                    type='text'
                                    placeholder='Search...'
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className='w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-7 pr-2 py-1 text-[11px] text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none'
                                />
                            </div>
                        </div>
                    </div>

                    <div className='overflow-y-auto divide-y divide-slate-100 max-h-[420px]'>
                        {error ? (
                            <div className='p-8 text-center space-y-2'>
                                <p className='text-xs font-semibold text-rose-600'>{error}</p>
                                <button
                                    type='button'
                                    onClick={loadLive}
                                    className='text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer'
                                >
                                    Retry
                                </button>
                            </div>
                        ) : loading && notifications.length === 0 ? (
                            <div className='p-8 text-center text-slate-400 text-xs font-semibold'>
                                Loading notifications…
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className='p-8 text-center text-slate-400 space-y-2'>
                                <div className='mx-auto flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400'>
                                    <Bell size={18} />
                                </div>
                                <p className='text-xs font-semibold text-slate-600'>No notifications found</p>
                                <p className='text-[11px] text-slate-400'>
                                    {activeFilter === 'unread'
                                        ? "You're all caught up! No unread notifications."
                                        : 'No notifications match your search query.'}
                                </p>
                            </div>
                        ) : (
                            filteredNotifications.map((item) => {
                                const IconComponent = TYPE_ICONS[item.type] || Bell
                                const badgeStyle = staffTypeBadgeColor[item.type] || 'bg-slate-100 text-slate-700'

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-3.5 transition-colors relative group ${
                                            !item.isRead
                                                ? 'bg-blue-50/30 hover:bg-blue-50/60'
                                                : 'bg-white hover:bg-slate-50/70'
                                        }`}
                                    >
                                        <div className='flex items-start gap-3'>
                                            <div
                                                className={`size-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                                    !item.isRead
                                                        ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-200/50'
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}
                                            >
                                                <IconComponent size={15} />
                                            </div>

                                            <div className='flex-1 min-w-0 space-y-1'>
                                                <div className='flex items-center justify-between gap-2'>
                                                    <div className='flex items-center gap-1.5 flex-wrap'>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeStyle}`}>
                                                            {item.type}
                                                        </span>
                                                        {item.meta && (
                                                            <span className='text-[10px] text-slate-400 font-medium'>
                                                                · {item.meta}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className='text-[10px] text-slate-400 font-medium whitespace-nowrap'>
                                                        {item.notificationDate || item.relatedDate}
                                                    </span>
                                                </div>

                                                <h4 className={`text-xs ${!item.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                                                    {item.title}
                                                </h4>

                                                <p className='text-[11px] text-slate-600 leading-relaxed'>
                                                    {item.message}
                                                </p>

                                                <div className='flex items-center justify-between pt-1 text-[10px] text-slate-400'>
                                                    <span>By: {item.postedBy || 'System'}</span>

                                                    {!item.isRead && (
                                                        <button
                                                            type='button'
                                                            onClick={() => markAsRead(item.id)}
                                                            className='inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer bg-blue-100/60 hover:bg-blue-100 px-2 py-0.5 rounded-lg'
                                                        >
                                                            <Check size={12} /> Mark as Read
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    <div className='p-2.5 border-t border-slate-100 bg-slate-50/50 text-center text-[11px] text-slate-500'>
                        Institution Broadcasts & Operational Alerts
                    </div>
                </div>
            )}
        </div>
    )
}

export default UserNotifications
