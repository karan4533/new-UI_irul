/**
 * Ensures annual SOY leaderboard eligibility uses the four mandatory gates.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateAcademicStarOfYear, CURRENT_ACADEMIC_YEAR } from '../recognitionData.js'

describe('calculateAcademicStarOfYear eligibility', () => {
  it('marks candidates with eligibilityGates and never uses NaN GPA as pass', () => {
    const rankings = calculateAcademicStarOfYear(CURRENT_ACADEMIC_YEAR)
    assert.ok(Array.isArray(rankings))
    assert.ok(rankings.length > 0)

    for (const cand of rankings) {
      assert.ok(Array.isArray(cand.eligibilityGates))
      assert.equal(cand.eligibilityGates.length, 4)
      assert.ok(['PASSED', 'FAILED'].includes(cand.overallResult))
      assert.equal(cand.isEligible, cand.overallResult === 'PASSED')
      assert.equal(cand.isEligible, cand.eligibilityGates.every((g) => g.passed))

      const gpaGate = cand.eligibilityGates.find((g) => g.id === 'gpa')
      assert.ok(gpaGate)
      if (gpaGate.passed) {
        assert.ok(Number.isFinite(Number(cand.cumulativeGpa)))
        assert.ok(Number(cand.cumulativeGpa) >= 8.5)
      }
      assert.notEqual(String(gpaGate.achieved), 'NaN GPA')
    }

    const aarav = rankings.find((c) => c.studentId === 'STU-2024-0142')
    assert.ok(aarav, 'Aarav Sharma should appear on academic SOY leaderboard')
    assert.ok(aarav.somCount >= 2)
    assert.equal(aarav.isEligible, true)
  })
})
