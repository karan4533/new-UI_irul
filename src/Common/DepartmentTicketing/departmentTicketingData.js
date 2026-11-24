/**
 * Centralized Department-Wise Ticketing & SLA Data Engine
 * Single Source of Truth for:
 * - Dynamic Department Master & Target Queue Routing
 * - Department-Tailored Issue Categories & Priority Matrix
 * - SLA Hour Calculation & Auto-Escalation Triggers
 * - Ticket Assignment, In-Progress Updates & Public/Internal Timeline
 * - Resolution Verification, Requester Confirmation & Reopening Workflow
 */

import { recordAuditLog, dispatchNotification } from '../AuditAndNotifications/centralAuditEngine.js'

export const TICKETS_STORAGE_KEY = 'schoolerp-department-tickets-v1'

let _memoryTickets = null

// Dynamic Department Master & Manager Mapping
export const DEPARTMENT_CONFIGS = [
    {
        name: 'IT Support & Systems',
        code: 'IT',
        managerId: 'EMP-IT-001',
        managerName: 'Rakesh Nair',
        managerRole: 'it-support-manager',
        slaTargetHours: { Critical: 4, High: 12, Medium: 24, Low: 48 },
        categories: [
            'Classroom Interactive Smartboard / Projector',
            'Campus WiFi & LAN Network Connectivity',
            'Computer Lab Hardware & Peripherals',
            'ERP Portal Access & Authentication',
            'Printer / Copier Network Fault',
            'Software Installation & OS Licensing'
        ]
    },
    {
        name: 'Facilities & Campus Sanitation',
        code: 'HK',
        managerId: 'EMP-HK-001',
        managerName: 'Savitri Devi',
        managerRole: 'housekeeping-manager',
        slaTargetHours: { Critical: 2, High: 6, Medium: 12, Low: 24 },
        categories: [
            'Classroom / Laboratory Deep Cleaning',
            'Restroom Sanitation & Consumable Refill',
            'Campus Waste Management & Garbage Clearance',
            'Water Cooler & Dispenser Sanitization',
            'Pest Control & Fumigation Service'
        ]
    },
    {
        name: 'Maintenance & Electrical',
        code: 'MNT',
        managerId: 'EMP-MNT-001',
        managerName: 'Gopalakrishnan R',
        managerRole: 'maintenancemanager',
        slaTargetHours: { Critical: 2, High: 8, Medium: 24, Low: 48 },
        categories: [
            'Electrical Power Outage / MCB Tripping',
            'Air Conditioning (HVAC) Cooling Malfunction',
            'Plumbing Leakage & Restroom Fitting Repair',
            'Desk, Bench & Classroom Carpentry',
            'Masonry, Painting & Door/Window Repairs'
        ]
    },
    {
        name: 'Transport & Fleet Logistics',
        code: 'TRN',
        managerId: 'EMP-TRN-001',
        managerName: 'Dharmesh Patel',
        managerRole: 'transport-manager',
        slaTargetHours: { Critical: 2, High: 6, Medium: 24, Low: 48 },
        categories: [
            'School Bus Route & Timing Adjustment',
            'Student Pickup / Drop Point Reallocation',
            'Bus GPS Live Tracking Issue',
            'Driver / Conductor Service Feedback',
            'Emergency Vehicle Breakdown Support'
        ]
    },
    {
        name: 'Stores & Procurement',
        code: 'STR',
        managerId: 'EMP-STR-001',
        managerName: 'Gurpreet Singh',
        managerRole: 'stationery-store-manager',
        slaTargetHours: { Critical: 4, High: 12, Medium: 24, Low: 72 },
        categories: [
            'Urgent Examination Stationery Shortage',
            'Science Laboratory Reagent Dispensing',
            'Defective Batch Item Replacement',
            'Asset Tagging & Furniture Allocation'
        ]
    },
    {
        name: 'Human Resources (HR)',
        code: 'HR',
        managerId: 'EMP-HR-001',
        managerName: 'Sunita Deshmukh',
        managerRole: 'hr',
        slaTargetHours: { Critical: 12, High: 24, Medium: 48, Low: 72 },
        categories: [
            'Salary Slip & Direct Deposit Query',
            'Provident Fund (PF) & Gratuity Assistance',
            'Medical Insurance & Cashless Card Claims',
            'Faculty Experience Certificate & NOC',
            'Staff Child Tuition Fee Concession'
        ]
    },
    {
        name: 'Finance & Accounts',
        code: 'FIN',
        managerId: 'EMP-ACC-001',
        managerName: 'K. Venkataraman',
        managerRole: 'account-head',
        slaTargetHours: { Critical: 8, High: 24, Medium: 48, Low: 72 },
        categories: [
            'Department Requisition Budget Allocation',
            'Vendor Invoice 3-Way Matching & Payment',
            'Staff Travel & Reimbursement Settlement',
            'Student Fee Challan Reconciliation'
        ]
    },
    {
        name: 'Campus Security & Access Control',
        code: 'SEC',
        managerId: 'EMP-GKM-001',
        managerName: 'Bhawani Singh',
        managerRole: 'gatekeeper-manager',
        slaTargetHours: { Critical: 2, High: 6, Medium: 24, Low: 48 },
        categories: [
            'Emergency Campus Gate Lockdown Support',
            'Lost Student ID Card Gate Transit Pass',
            'Unauthorized Parking & Gate Traffic Control',
            'CCTV Surveillance Footage Review Request'
        ]
    },
    {
        name: 'Academics & Teaching',
        code: 'ACAD',
        managerId: 'EMP-CRD-001',
        managerName: 'Kavita Menon',
        managerRole: 'coordinator',
        slaTargetHours: { Critical: 4, High: 12, Medium: 24, Low: 48 },
        categories: [
            'Substitute Teacher Emergency Assignment',
            'Timetable Classroom Clash Rectification',
            'Examination Schedule Overlap Grievance',
            'Class Section Student Transfer Review'
        ]
    }
]

// Initial Seed Tickets
export const INITIAL_TICKETS = [
    {
        id: 'TICK-2026-001',
        ticketTitle: 'Primary Science Lab 2 Smartboard Optical Sensor Failure',
        targetDepartment: 'IT Support & Systems',
        issueCategory: 'Classroom Interactive Smartboard / Projector',
        priority: 'High',
        requestedById: 'EMP-TCH-006',
        requestedByName: 'Ananya Roy',
        requestingDepartment: 'Academics & Teaching',
        location: 'Junior Wing, Science Lab 2',
        description: 'Interactive stylus touch is unresponsive on the right quadrant of the screen. Classes disrupted.',
        attachments: [],
        assignedToId: 'EMP-IT-001',
        assignedToName: 'Rakesh Nair (IT Head)',
        slaHours: 12,
        createdDateTime: '31-10-2026 08:30 AM',
        targetResolutionDateTime: '31-10-2026 08:30 PM',
        actualResolutionDateTime: null,
        status: 'In Progress',
        timeline: [
            { timestamp: '31-10-2026 08:30 AM', actorName: 'Ananya Roy', action: 'Created', notes: 'Ticket raised with photo evidence.' },
            { timestamp: '31-10-2026 09:00 AM', actorName: 'Rakesh Nair', action: 'Assigned', notes: 'Assigned to IT hardware team. Sensor recalibration scheduled.' }
        ],
        resolutionSummary: '',
        requesterFeedback: null
    },
    {
        id: 'TICK-2026-002',
        ticketTitle: 'Water Pressure Loss in Senior Secondary Restrooms (3rd Floor)',
        targetDepartment: 'Maintenance & Electrical',
        issueCategory: 'Plumbing Leakage & Restroom Fitting Repair',
        priority: 'Critical',
        requestedById: 'EMP-TCH-014',
        requestedByName: 'Priya Menon',
        requestingDepartment: 'Academics & Teaching',
        location: 'Senior Secondary Block, 3rd Floor East Wing',
        description: 'Overhead overhead tank booster pump tripped. No running water in washrooms during interval.',
        attachments: [],
        assignedToId: 'EMP-HK-001',
        assignedToName: 'Savitri Devi',
        slaHours: 2,
        createdDateTime: '31-10-2026 09:15 AM',
        targetResolutionDateTime: '31-10-2026 11:15 AM',
        actualResolutionDateTime: '31-10-2026 10:45 AM',
        status: 'Resolved',
        timeline: [
            { timestamp: '31-10-2026 09:15 AM', actorName: 'Priya Menon', action: 'Created', notes: 'Urgent ticket raised.' },
            { timestamp: '31-10-2026 09:30 AM', actorName: 'Savitri Devi', action: 'Assigned', notes: 'Plumbing technician dispatched.' },
            { timestamp: '31-10-2026 10:45 AM', actorName: 'Savitri Devi', action: 'Resolved', notes: 'Booster pump reset and airlock cleared. Full pressure restored.' }
        ],
        resolutionSummary: 'Overhead tank pump secondary relay switch reset. Water lines flushed.',
        requesterRating: 5,
        requesterFeedback: {
            rating: 5,
            comments: 'Prompt and courteous resolution — water pressure restored before next period.',
            submittedAt: '31-10-2026 11:05 AM',
        },
    },
    {
        id: 'TICK-2026-003',
        ticketTitle: 'PF UAN Linking Discrepancy for New Faculty Member',
        targetDepartment: 'Human Resources (HR)',
        issueCategory: 'Provident Fund (PF) & Gratuity Assistance',
        priority: 'Medium',
        requestedById: 'EMP-TCH-007',
        requestedByName: 'Dr. Subramanian',
        requestingDepartment: 'Academics & Teaching',
        location: 'Physics Department Faculty Room',
        description: 'Previous employer PF member ID not reflecting in epfindia portal under unified UAN.',
        attachments: [],
        assignedToId: 'EMP-HR-001',
        assignedToName: 'Sunita Deshmukh',
        slaHours: 48,
        createdDateTime: '29-10-2026 11:00 AM',
        targetResolutionDateTime: '31-10-2026 11:00 AM',
        actualResolutionDateTime: null,
        status: 'Assigned',
        timeline: [
            { timestamp: '29-10-2026 11:00 AM', actorName: 'Dr. Subramanian', action: 'Created', notes: 'Form 13 details submitted.' },
            { timestamp: '29-10-2026 02:00 PM', actorName: 'Sunita Deshmukh', action: 'Assigned', notes: 'Coordinating with EPFO zonal desk.' }
        ],
        resolutionSummary: '',
        requesterFeedback: null
    }
]

// Storage Accessors
export const getDepartmentTickets = () => {
    // Prefer in-memory when present so a failed/partial localStorage write cannot hide new tickets.
    if (_memoryTickets && Array.isArray(_memoryTickets) && _memoryTickets.length > 0) {
        return _memoryTickets.map(normalizeTicketForUi)
    }
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(TICKETS_STORAGE_KEY)
            if (raw) {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    _memoryTickets = parsed
                    return parsed.map(normalizeTicketForUi)
                }
            }
        }
    } catch {
        /* ignore */
    }
    _memoryTickets = [...INITIAL_TICKETS]
    saveDepartmentTickets(_memoryTickets)
    return _memoryTickets.map(normalizeTicketForUi)
}

export const saveDepartmentTickets = (tickets) => {
    _memoryTickets = tickets
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets))
        }
    } catch {
        /* ignore */
    }
}

// Workflows

/**
 * 1. Raise New Ticket for Any Target Department
 */
/** Normalize ticket fields for UI consumers (ticketNumber/title/category aliases). */
export const normalizeTicketForUi = (ticket) => {
    if (!ticket) return ticket
    const feedback = ticket.requesterFeedback
    const rating = ticket.requesterRating ?? (feedback && typeof feedback === 'object' ? feedback.rating : 0) ?? 0
    const feedbackText =
        typeof feedback === 'string'
            ? feedback
            : feedback && typeof feedback === 'object'
              ? feedback.comments || ''
              : ''
    return {
        ...ticket,
        ticketNumber: ticket.ticketNumber || ticket.id,
        title: ticket.title || ticket.ticketTitle || '',
        ticketTitle: ticket.ticketTitle || ticket.title || '',
        category: ticket.category || ticket.issueCategory || '',
        issueCategory: ticket.issueCategory || ticket.category || '',
        raisedByName: ticket.raisedByName || ticket.requestedByName || '',
        raisedByDepartment: ticket.raisedByDepartment || ticket.requestingDepartment || '',
        assignedStaffName: ticket.assignedStaffName || ticket.assignedToName || '',
        assignedStaffId: ticket.assignedStaffId || ticket.assignedToId || '',
        slaHours: ticket.slaHours ?? ticket.slaTargetHours ?? null,
        requesterRating: Number(rating) || 0,
        requesterFeedback: feedbackText,
        resolutionRemarks: ticket.resolutionRemarks || ticket.resolutionSummary || '',
    }
}

export const normalizeDepartmentConfigForUi = (dept) => {
    if (!dept) return dept
    const slaHours =
        typeof dept.slaHours === 'number'
            ? dept.slaHours
            : dept.slaTargetHours?.Medium ?? dept.slaTargetHours?.High ?? dept.slaTargetHours?.Critical ?? null
    return {
        ...dept,
        headOfDepartment: dept.headOfDepartment || dept.managerName || '',
        slaHours,
    }
}

export const raiseDepartmentTicket = ({
    ticketTitle,
    title,
    targetDepartment,
    issueCategory,
    category,
    priority = 'Medium',
    requestedById,
    raisedByEmployeeId,
    requestedByName,
    raisedByName,
    requestingDepartment,
    raisedByDepartment,
    location,
    description,
    attachments = []
}) => {
    const resolvedTitle = String(ticketTitle || title || '').trim()
    const resolvedCategory = String(issueCategory || category || '').trim()
    const resolvedRequesterName = requestedByName || raisedByName || 'Staff'
    const resolvedRequesterId = requestedById || raisedByEmployeeId || 'EMP-GEN'
    const resolvedRequestingDept = requestingDepartment || raisedByDepartment || 'General'

    if (!resolvedTitle) {
        throw new Error('Ticket title is required.')
    }
    if (!targetDepartment) {
        throw new Error('Target department is required.')
    }

    const deptConfig =
        DEPARTMENT_CONFIGS.find((d) => d.name === targetDepartment) ||
        DEPARTMENT_CONFIGS.find((d) => d.name.toLowerCase().includes(String(targetDepartment).toLowerCase())) ||
        DEPARTMENT_CONFIGS[0]
    const slaHours = deptConfig.slaTargetHours[priority] || 24

    const tickets = getDepartmentTickets()
    const nextSeq = tickets.length + 1
    const newId = `TICK-2026-${String(nextSeq).padStart(3, '0')}`

    const now = new Date()
    const nowStr = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    const targetResolution = new Date(now.getTime() + slaHours * 3600000)
    const targetStr = targetResolution.toLocaleDateString('en-GB') + ' ' + targetResolution.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

    const newTicket = {
        id: newId,
        ticketNumber: newId,
        ticketTitle: resolvedTitle,
        title: resolvedTitle,
        targetDepartment: deptConfig.name,
        issueCategory: resolvedCategory || deptConfig.categories?.[0] || 'General',
        category: resolvedCategory || deptConfig.categories?.[0] || 'General',
        priority,
        requestedById: resolvedRequesterId,
        requestedByName: resolvedRequesterName,
        raisedByName: resolvedRequesterName,
        requestingDepartment: resolvedRequestingDept,
        raisedByDepartment: resolvedRequestingDept,
        location,
        description,
        attachments,
        assignedToId: deptConfig.managerId,
        assignedToName: deptConfig.managerName,
        assignedStaffName: deptConfig.managerName,
        assignedStaffId: deptConfig.managerId,
        slaHours,
        createdDateTime: nowStr,
        targetResolutionDateTime: targetStr,
        actualResolutionDateTime: null,
        status: 'Submitted',
        timeline: [
            {
                timestamp: nowStr,
                actorName: resolvedRequesterName,
                action: 'Submitted',
                notes: `Ticket raised for ${deptConfig.name}. Priority: ${priority}.`
            }
        ],
        resolutionSummary: '',
        requesterFeedback: null
    }

    const updated = [newTicket, ...tickets]
    saveDepartmentTickets(updated)

    recordAuditLog({
        actorId: resolvedRequesterId,
        actorName: resolvedRequesterName,
        module: 'Department Ticketing',
        action: 'RAISE_TICKET',
        entityId: newId,
        previousState: 'None',
        newState: 'Submitted',
        remarks: `${priority} ticket '${resolvedTitle}' routed to ${deptConfig.name}`
    })

    dispatchNotification({
        recipientId: deptConfig.managerId,
        recipientRole: deptConfig.managerRole,
        title: `New Ticket in ${deptConfig.name} Queue`,
        message: `${newId} (${priority}): ${resolvedTitle} reported by ${resolvedRequesterName}. SLA: ${slaHours}h.`,
        link: '/department-tickets?tab=queue',
        priority: priority === 'Critical' ? 'Critical' : 'Normal',
        type: 'DEPARTMENT_TICKET'
    })

    return normalizeTicketForUi(newTicket)
}

/**
 * 2. Assign Ticket to Specialist / Staff (Department Head / Manager)
 */
export const assignTicketToStaff = ({
    ticketId,
    ticketNumber,
    assignedToId,
    assignedStaffId,
    assignedToName,
    assignedStaffName,
    managerName = 'Department Manager',
    assignedByStaffName,
    instructions = '',
    notes = ''
}) => {
    const resolvedId = ticketId || ticketNumber
    const resolvedAssigneeId = assignedToId || assignedStaffId
    const resolvedAssigneeName = assignedToName || assignedStaffName
    const resolvedManager = assignedByStaffName || managerName
    const resolvedNotes = instructions || notes || ''

    const tickets = getDepartmentTickets()
    const target = tickets.find((t) => t.id === resolvedId || t.ticketNumber === resolvedId)
    if (!target) throw new Error('Ticket not found.')
    if (!resolvedAssigneeId || !resolvedAssigneeName) {
        throw new Error('Assignee staff id and name are required.')
    }

    const oldStatus = target.status
    target.assignedToId = resolvedAssigneeId
    target.assignedToName = resolvedAssigneeName
    target.assignedStaffId = resolvedAssigneeId
    target.assignedStaffName = resolvedAssigneeName
    target.status = 'Assigned'

    const nowStr = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    target.timeline.push({
        timestamp: nowStr,
        actorName: resolvedManager,
        action: 'Assigned',
        notes: `Assigned to ${resolvedAssigneeName}. ${resolvedNotes}`.trim()
    })

    saveDepartmentTickets(tickets)

    recordAuditLog({
        actorName: resolvedManager,
        module: 'Department Ticketing',
        action: 'ASSIGN_TICKET',
        entityId: resolvedId,
        previousState: oldStatus,
        newState: 'Assigned',
        remarks: `Assigned to ${resolvedAssigneeName}`
    })

    dispatchNotification({
        recipientId: resolvedAssigneeId,
        title: `Ticket ${resolvedId} Assigned to You`,
        message: `You have been assigned ${resolvedId}: '${target.ticketTitle || target.title}'. Target SLA: ${target.targetResolutionDateTime}.`,
        link: '/department-tickets?tab=assigned',
        type: 'DEPARTMENT_TICKET'
    })

    return normalizeTicketForUi(target)
}

/**
 * 3. Update Ticket Progress / Status (Assigned Staff)
 */
export const updateTicketProgress = ({
    ticketId,
    ticketNumber,
    newStatus,
    status,
    actorName,
    updatedByName,
    workNotes,
    resolutionRemarks,
    resolutionSummary = ''
}) => {
    const resolvedId = ticketId || ticketNumber
    const resolvedStatus = newStatus || status
    const resolvedActor = actorName || updatedByName || 'Staff'
    const resolvedNotes = workNotes || resolutionRemarks || ''

    const tickets = getDepartmentTickets()
    const target = tickets.find((t) => t.id === resolvedId || t.ticketNumber === resolvedId)
    if (!target) throw new Error('Ticket not found.')
    if (!resolvedStatus) throw new Error('New ticket status is required.')

    const oldStatus = target.status
    target.status = resolvedStatus

    const nowStr = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

    if (String(resolvedStatus).toLowerCase().includes('resolved')) {
        target.actualResolutionDateTime = nowStr
        target.resolutionSummary = resolutionSummary || resolvedNotes
        target.resolutionRemarks = resolutionSummary || resolvedNotes
    }

    target.timeline.push({
        timestamp: nowStr,
        actorName: resolvedActor,
        action: resolvedStatus,
        notes: resolvedNotes || `Status updated to ${resolvedStatus}`
    })

    saveDepartmentTickets(tickets)

    recordAuditLog({
        actorName: resolvedActor,
        module: 'Department Ticketing',
        action: `TICKET_${String(resolvedStatus).toUpperCase().replace(/\s+/g, '_')}`,
        entityId: resolvedId,
        previousState: oldStatus,
        newState: resolvedStatus,
        remarks: resolvedNotes
    })

    if (String(resolvedStatus).toLowerCase().includes('resolved')) {
        dispatchNotification({
            recipientId: target.requestedById,
            title: `Ticket ${resolvedId} Resolved`,
            message: `Work on '${target.ticketTitle || target.title}' has been completed by ${resolvedActor}. Please confirm closure.`,
            link: '/department-tickets?tab=my-tickets',
            priority: 'High',
            type: 'DEPARTMENT_TICKET'
        })
    }

    return normalizeTicketForUi(target)
}

/**
 * 4. Confirm Closure or Reopen Ticket (Requester)
 */
export const confirmTicketClosure = ({
    ticketId,
    ticketNumber,
    action = 'Confirmed & Closed', // 'Confirmed & Closed' | 'Reopened'
    requesterName,
    requesterRating,
    requesterFeedback,
    feedbackRating = 5,
    feedbackComments = ''
}) => {
    const resolvedId = ticketId || ticketNumber
    const rating = requesterRating ?? feedbackRating
    const comments = requesterFeedback || feedbackComments || ''

    const tickets = getDepartmentTickets()
    const target = tickets.find((t) => t.id === resolvedId || t.ticketNumber === resolvedId)
    if (!target) throw new Error('Ticket not found.')

    const oldStatus = target.status
    const nowStr = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

    if (action === 'Confirmed & Closed' || action === 'Closed') {
        target.status = 'Confirmed & Closed'
        target.requesterFeedback = {
            rating: Number(rating),
            comments,
            timestamp: nowStr
        }
        target.requesterRating = Number(rating)
    } else {
        target.status = 'Reopened'
    }

    target.timeline.push({
        timestamp: nowStr,
        actorName: requesterName,
        action: target.status === 'Confirmed & Closed' ? 'Confirmed & Closed' : action,
        notes: comments || (target.status === 'Confirmed & Closed' ? 'Closure confirmed by requester.' : 'Ticket reopened.')
    })

    saveDepartmentTickets(tickets)

    recordAuditLog({
        actorName: requesterName,
        module: 'Department Ticketing',
        action: target.status === 'Confirmed & Closed' ? 'CLOSE_TICKET' : 'REOPEN_TICKET',
        entityId: resolvedId,
        previousState: oldStatus,
        newState: target.status,
        remarks: comments
    })

    return normalizeTicketForUi(target)
}

