import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateGrade } from '../src/utils/GradeCalculator.js'

const bands = [
  { band_group: 'primary', minimum_score: 60, maximum_score: 100, grade: 'Mastery', points: 1, description: 'Meets target' },
  { band_group: 'primary', minimum_score: 0, maximum_score: 59, grade: 'Developing', points: 2, description: 'In progress' },
  { band_group: 'olevel', minimum_score: 0, maximum_score: 100, grade: 'Configured O', points: 7, description: 'Configured' },
]

test('configured school bands drive current mark outcomes', () => {
  assert.deepEqual(calculateGrade(70, 'Grade 4', bands), { grade: 'Mastery', points: 1, description: 'Meets target' })
  assert.deepEqual(calculateGrade(42, 'Form 3', bands), { grade: 'Configured O', points: 7, description: 'Configured' })
})

test('a configured scale with no matching band does not silently use hard-coded outcomes', () => {
  assert.equal(calculateGrade(70, 'Grade 4', []), null)
})

test('existing callers retain the baseline until they supply configured bands', () => {
  assert.equal(calculateGrade(85, 'Grade 4').grade, 'Unit 1')
})
