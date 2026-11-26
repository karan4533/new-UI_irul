/**
 * Activity fee helpers — live API only (PostgreSQL campus finance snapshot).
 * localStorage is no longer the source of truth.
 */

export { ACTIVITY_TYPES, PARTICIPANT_TYPES } from './activityFeeConstants.js'

export const payableAmount = (assignment) => {
    const gross = Number(assignment.gross) || 0
    if (assignment.concessionMode === 'Percentage') {
        return Math.max(0, gross - (gross * (Number(assignment.concessionValue) || 0)) / 100)
    }
    if (assignment.concessionMode === 'Fixed Amount') {
        return Math.max(0, gross - (Number(assignment.concessionValue) || 0))
    }
    return gross
}
