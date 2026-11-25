import React from 'react'
import StaffNotificationsPage from '../../../Common/Notifications/StaffNotificationsPage'
import {
    NOTIFICATION_TYPES,
    STUDENT_NOTIFICATIONS,
    typeBadgeColor,
} from './notificationsData'

const NotificationsList = () => (
    <StaffNotificationsPage
        title='Notifications'
        fallback={STUDENT_NOTIFICATIONS}
        notificationTypes={NOTIFICATION_TYPES}
        typeBadgeColor={typeBadgeColor}
    />
)

export default NotificationsList
