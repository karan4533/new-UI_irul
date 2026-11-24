/**
 * Unit tests for shared SOY mandatory gate evaluation.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveCumulativeGpa10,
  evaluateMandatorySoyGates,
  parseRequiredNumber,
} from '../modules/soyEligibility.js'

describe('soyEligibility', () => {
  it('rejects missing and non-numeric GPA values', () => {
    assert.equal(parseRequiredNumber(undefined).ok, false)
    assert.equal(parseRequiredNumber(null).ok, false)
    assert.equal(parseRequiredNumber('').ok, false)
    assert.equal(parseRequiredNumber('NaN').ok, false)
    assert.equal(parseRequiredNumber('abc').ok, false)
    assert.equal(parseRequiredNumber(9.6).ok, true)
  })

  it('derives 10-point GPA from avgScore / avgKpi without inventing defaults', () => {
    assert.equal(deriveCumulativeGpa10({ avgScore: 96 }).value, 9.6)
    assert.equal(deriveCumulativeGpa10({ avgKpi: 98 }).value, 9.8)
    assert.equal(deriveCumulativeGpa10({}).ok, false)
    assert.equal(deriveCumulativeGpa10({ avgScore: 'bad' }).ok, false)
  })

  it('marks overall PASSED only when all four gates pass', () => {
    const ok = evaluateMandatorySoyGates({
      somWinsCount: 2,
      cumulativeGpa: 9.6,
      attendancePercentage: 96.5,
      infractions: 0,
    })
    assert.equal(ok.isEligible, true)
    assert.equal(ok.overallResult, 'PASSED')
    assert.equal(ok.gates.length, 4)
  })

  it('fails overall when GPA gate fails and reports the gate name', () => {
    const bad = evaluateMandatorySoyGates({
      somWinsCount: 3,
      cumulativeGpa: null,
      attendancePercentage: 98,
      infractions: 0,
    })
    assert.equal(bad.isEligible, false)
    assert.equal(bad.overallResult, 'FAILED')
    assert.ok(bad.failedNames.includes('Cumulative GPA'))
  })

  it('fails when GPA is below 8.5 even if SOM wins are met', () => {
    const low = evaluateMandatorySoyGates({
      somWinsCount: 2,
      cumulativeGpa: 8.0,
      attendancePercentage: 97,
      infractions: 0,
    })
    assert.equal(low.isEligible, false)
    assert.equal(low.values.gpaMet, false)
  })
})
