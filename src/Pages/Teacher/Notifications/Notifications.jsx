import React from 'react'
import StaffNotificationsPage from '../../../Common/Notifications/StaffNotificationsPage'
import { getNotifications, NOTIFICATION_TYPES, typeBadgeColor } from './notificationsData'

const Notifications = () => (
    <StaffNotificationsPage
        title='Teacher notifications'
        fallback={getNotifications()}
        notificationTypes={NOTIFICATION_TYPES}
        typeBadgeColor={typeBadgeColor}
    />
)

export default Notifications
