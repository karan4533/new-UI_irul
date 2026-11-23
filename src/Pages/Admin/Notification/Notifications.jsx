import React from 'react'
import StaffNotificationsPage from '../../../Common/Notifications/StaffNotificationsPage'
import { NOTIFICATIONS, NOTIFICATION_TYPES, typeBadgeColor } from './notificationsData'

const Notifications = () => (
    <StaffNotificationsPage
        title='Notifications'
        fallback={NOTIFICATIONS}
        notificationTypes={NOTIFICATION_TYPES}
        typeBadgeColor={typeBadgeColor}
    />
)

export default Notifications
