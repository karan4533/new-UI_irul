import { CLASSES, SECTIONS, SUBJECTS } from '../AssignedClass/assignedClassData'
import { canUseAcademicsApi } from '../../../services/api/academicsApiService.js'
import { readAcademicsCollection, writeAcademicsCollection } from '../../../services/api/academicsLiveCollection.js'

const LIVE_COLLECTION = 'online-classes'
const STORAGE_KEY = 'school-erp-online-classes-v1'

export const MEETING_PLATFORMS = [
    'Google Meet',
    'Zoom',
    'Microsoft Teams',
    'Cisco Webex',
]

export const ONLINE_CLASS_STATUSES = ['Scheduled', 'Completed']

export const statusBadgeColor = {
    Scheduled: 'bg-[#2196F333] text-[#2196F3]',
    Completed: 'bg-[#4CAF5033] text-[#4CAF50]',
}

export const DEFAULT_ONLINE_CLASSES = [
    {
        id: 'OC-1001',
        onlineClassId: 'OC-1001',
        subject: 'Mathematics',
        className: '10',
        section: 'A',
        topic: 'Quadratic Equations — Live Problem Session',
        date: '12-06-2026',
        startTime: '09:00 AM',
        endTime: '10:00 AM',
        meetingPlatform: 'Google Meet',
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        status: 'Scheduled',
    },
    {
        id: 'OC-1002',
        onlineClassId: 'OC-1002',
        subject: 'Mathematics',
        className: '10',
        section: 'B',
        topic: 'Trigonometry — Identity Proofs',
        date: '05-06-2026',
        startTime: '10:30 AM',
        endTime: '11:30 AM',
        meetingPlatform: 'Zoom',
        meetingLink: 'https://zoom.us/j/1234567890',
        status: 'Completed',
    },
    {
        id: 'OC-1003',
        onlineClassId: 'OC-1003',
        subject: 'Mathematics',
        className: '9',
        section: 'A',
        topic: 'Algebra — Factorisation Techniques',
        date: '14-06-2026',
        startTime: '02:00 PM',
        endTime: '03:00 PM',
        meetingPlatform: 'Microsoft Teams',
        meetingLink: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting',
        status: 'Scheduled',
    },
    {
        id: 'OC-1004',
        onlineClassId: 'OC-1004',
        subject: 'Mathematics',
        className: '11',
        section: 'A',
        topic: 'Calculus — Limits & Continuity',
        date: '01-06-2026',
        startTime: '11:00 AM',
        endTime: '12:15 PM',
        meetingPlatform: 'Google Meet',
        meetingLink: 'https://meet.google.com/xyz-abcd-efg',
        status: 'Completed',
    },
    {
        id: 'OC-1005',
        onlineClassId: 'OC-1005',
        subject: 'Mathematics',
        className: '10',
        section: 'A',
        topic: 'Statistics — Mean, Median & Mode',
        date: '18-06-2026',
        startTime: '03:30 PM',
        endTime: '04:30 PM',
        meetingPlatform: 'Cisco Webex',
        meetingLink: 'https://school.webex.com/meet/math-teacher',
        status: 'Scheduled',
    },
]

export const getOnlineClasses = () => {
    if (canUseAcademicsApi()) {
        return readAcademicsCollection(LIVE_COLLECTION) // [] until hydrated
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
    } catch {
        /* ignore */
    }
    return DEFAULT_ONLINE_CLASSES
}

export const saveOnlineClasses = (records) => {
    if (canUseAcademicsApi()) {
        writeAcademicsCollection(LIVE_COLLECTION, records)
        return
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    } catch {
        /* ignore */
    }
}

export const getOnlineClassById = (id) =>
    getOnlineClasses().find((item) => item.id === id) ?? null

export { CLASSES, SECTIONS, SUBJECTS }
