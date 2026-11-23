import React, { useCallback, useEffect, useState } from 'react'
import NotificationsListView from './NotificationsListView'
import {
    STAFF_NOTIFICATIONS,
    STAFF_NOTIFICATION_TYPES,
    staffTypeBadgeColor,
} from './staffNotificationsData'
import { isLiveApiEnabled } from '../../services/api/tokenStore'
import {
    listNotifications,
    markNotificationRead,
} from '../../services/api/notificationsApiService'

/**
 * Campus notifications for staff/ops roles — live FastAPI when enabled.
 */
export default function StaffNotificationsPage({
    fallback = STAFF_NOTIFICATIONS,
    notificationTypes = STAFF_NOTIFICATION_TYPES,
    typeBadgeColor = staffTypeBadgeColor,
    title = 'Notifications',
}) {
    const live = isLiveApiEnabled()
    const [items, setItems] = useState(() => (live ? [] : fallback))
    const [loading, setLoading] = useState(live)
    const [error, setError] = useState('')

    const loadLive = useCallback(async () => {
        if (!isLiveApiEnabled()) return
        setLoading(true)
        setError('')
        const res = await listNotifications()
        if (!res.success) {
            setItems([])
            setError(res.error || 'Notifications could not be loaded.')
            setLoading(false)
            return
        }
        setItems(Array.isArray(res.data) ? res.data : [])
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!live) {
            setItems(fallback)
            setLoading(false)
            return undefined
        }
        loadLive()
        return undefined
    }, [live, fallback, loadLive])

    const handleOpen = (record) => {
        if (!record || record.isRead) return
        setItems((current) =>
            current.map((item) => (item.id === record.id ? { ...item, isRead: true } : item)),
        )
        if (!live) return
        markNotificationRead(record.id).then((res) => {
            if (!res.success) {
                setItems((current) =>
                    current.map((item) => (item.id === record.id ? { ...item, isRead: false } : item)),
                )
            }
        })
    }

    if (live && loading) {
        return <p className='text-[#667085]'>Loading notifications…</p>
    }

    if (live && error) {
        return (
            <div className='space-y-2'>
                <p className='text-[#B42318]'>{error}</p>
                <button
                    type='button'
                    onClick={loadLive}
                    className='text-sm font-semibold text-[#515DEF] hover:underline cursor-pointer'
                >
                    Retry
                </button>
            </div>
        )
    }

    return (
        <NotificationsListView
            notifications={items}
            notificationTypes={notificationTypes}
            typeBadgeColor={typeBadgeColor}
            title={title}
            onOpen={handleOpen}
        />
    )
}
