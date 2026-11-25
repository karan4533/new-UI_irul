/**
 * Shared Star of the Year (SOY) mandatory eligibility evaluation.
 * Single source of truth for GPA/attendance/SOM-wins/infractions gates
 * used by awardsService, recognition leaderboard, and Audit Gates UI.
 */

export const SOY_GPA_THRESHOLD = 8.5
export const SOY_ATTENDANCE_THRESHOLD = 95
export const SOY_MIN_SOM_WINS = 2

/**
 * Parse a required numeric metric. Missing / blank / non-finite never coerce to a default.
 * @returns {{ ok: true, value: number } | { ok: false, value: null, reason: 'missing' | 'invalid' }}
 */
export function parseRequiredNumber(value) {
  if (value === null || value === undefined || value === '') {
    return { ok: false, value: null, reason: 'missing' }
  }
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(n)) {
    return { ok: false, value: null, reason: 'invalid' }
  }
  return { ok: true, value: n }
}

/**
 * Derive 10-point cumulative GPA from candidate / nomination fields.
 * Prefers explicit cumulativeGpa; otherwise avgScore/10 or avgKpi/10.
 */
export function deriveCumulativeGpa10(source = {}) {
  if (source.cumulativeGpa !== null && source.cumulativeGpa !== undefined && source.cumulativeGpa !== '') {
    return parseRequiredNumber(source.cumulativeGpa)
  }
  const scoreSource = source.avgScore ?? source.avgKpi ?? source.scorePercentage
  const score = parseRequiredNumber(scoreSource)
  if (!score.ok) {
    return { ok: false, value: null, reason: score.reason }
  }
  return { ok: true, value: Number((score.value / 10).toFixed(2)) }
}

/**
 * Evaluate the four mandatory annual SOY governance gates.
 */
export function evaluateMandatorySoyGates({
  somWinsCount,
  cumulativeGpa,
  attendancePercentage,
  infractions = 0,
} = {}) {
  const gates = []

  const som = parseRequiredNumber(somWinsCount)
  const somPassed = som.ok && som.value >= SOY_MIN_SOM_WINS
  gates.push({
    id: 'somWins',
    name: 'Monthly SOM Wins',
    requirement: `≥ ${SOY_MIN_SOM_WINS} SOM Wins`,
    achieved: som.ok ? `${som.value} Wins` : `Unavailable (${som.reason})`,
    passed: somPassed,
    reason: somPassed
      ? null
      : !som.ok
        ? `SOM win count is ${som.reason}`
        : `Requires ≥ ${SOY_MIN_SOM_WINS} SOM wins (has ${som.value})`,
  })

  const gpa = parseRequiredNumber(cumulativeGpa)
  const gpaPassed = gpa.ok && gpa.value >= SOY_GPA_THRESHOLD
  gates.push({
    id: 'gpa',
    name: 'Cumulative GPA',
    requirement: `GPA ≥ ${SOY_GPA_THRESHOLD}`,
    achieved: gpa.ok ? `${gpa.value} GPA` : `Unavailable (${gpa.reason})`,
    passed: gpaPassed,
    reason: gpaPassed
      ? null
      : !gpa.ok
        ? `GPA is ${gpa.reason}`
        : `GPA ${gpa.value} is below ${SOY_GPA_THRESHOLD}`,
  })

  const att = parseRequiredNumber(attendancePercentage)
  const attPassed = att.ok && att.value >= SOY_ATTENDANCE_THRESHOLD
  gates.push({
    id: 'attendance',
    name: 'Session Attendance',
    requirement: `≥ ${SOY_ATTENDANCE_THRESHOLD}% Attendance`,
    achieved: att.ok ? `${att.value}%` : `Unavailable (${att.reason})`,
    passed: attPassed,
    reason: attPassed
      ? null
      : !att.ok
        ? `Attendance is ${att.reason}`
        : `Attendance ${att.value}% is below ${SOY_ATTENDANCE_THRESHOLD}%`,
  })

  const inf = parseRequiredNumber(infractions)
  const infPassed = inf.ok && inf.value === 0
  gates.push({
    id: 'infractions',
    name: 'Disciplinary Record',
    requirement: '0 Disciplinary Infractions',
    achieved: inf.ok ? `${inf.value} Infractions` : `Unavailable (${inf.reason})`,
    passed: infPassed,
    reason: infPassed
      ? null
      : !inf.ok
        ? `Infraction count is ${inf.reason}`
        : `${inf.value} disciplinary infraction(s) on record`,
  })

  const failedCriteria = gates.filter((g) => !g.passed)

  return {
    isEligible: failedCriteria.length === 0,
    overallResult: failedCriteria.length === 0 ? 'PASSED' : 'FAILED',
    gates,
    failedCriteria,
    failedNames: failedCriteria.map((g) => g.name),
    values: {
      somWinsCount: som.ok ? som.value : null,
      minimumSomWinsMet: somPassed,
      cumulativeGpa: gpa.ok ? gpa.value : null,
      gpaMet: gpaPassed,
      attendancePercentage: att.ok ? att.value : null,
      attendanceMet: attPassed,
      zeroDisciplinaryInfractions: infPassed,
      infractions: inf.ok ? inf.value : null,
    },
  }
}

/**
 * Build a human-readable failure summary for toasts / errors.
 */
export function formatSoyEligibilityFailure(evaluation) {
  if (!evaluation || evaluation.isEligible) return ''
  const parts = (evaluation.failedCriteria || []).map(
    (g) => `${g.name}: ${g.reason || 'failed'}`
  )
  return parts.length
    ? `Mandatory SOY criteria failed — ${parts.join('; ')}`
    : 'Nominee does not meet mandatory SOY criteria.'
}
