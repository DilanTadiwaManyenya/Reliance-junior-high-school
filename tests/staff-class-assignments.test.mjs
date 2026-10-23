import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeStaffClassAssignments, staffClassAssignmentConflict } from '../src/lib/staffClassAssignments.js'

test('teacher class allocations retain multiple independent class and stream pairs', () => {
  const assignments = normalizeStaffClassAssignments([
    { class_level: 'Form 1', class_stream: 'Blue' },
    { class_level: 'Form 2', class_stream: 'Commercials' },
    { class_level: 'Form 1', class_stream: 'Green' },
  ])

  assert.deepEqual(assignments, [
    { class_level: 'Form 1', class_stream: 'Blue' },
    { class_level: 'Form 2', class_stream: 'Commercials' },
    { class_level: 'Form 1', class_stream: 'Green' },
  ])
  assert.equal(staffClassAssignmentConflict(assignments, { class_level: 'Form 1', class_stream: 'Red' }), '')
  assert.match(staffClassAssignmentConflict(assignments, { class_level: 'Form 1', class_stream: 'Blue' }), /already assigned/)
})

test('whole-form assignments overlap and block narrower assignments for the same class', () => {
  const wholeForm = [{ class_level: 'Form 1', class_stream: '' }]
  assert.match(staffClassAssignmentConflict(wholeForm, { class_level: 'Form 1', class_stream: 'Blue' }), /overlaps/)
  assert.match(staffClassAssignmentConflict([{ class_level: 'Form 1', class_stream: 'Blue' }], { class_level: 'Form 1', class_stream: '' }), /overlaps/)
  assert.equal(staffClassAssignmentConflict(wholeForm, { class_level: 'Form 2', class_stream: 'Blue' }), '')
})

test('legacy class-level arrays still normalize using their shared stream value', () => {
  assert.deepEqual(normalizeStaffClassAssignments(['Form 1', 'Form 2'], 'Blue'), [
    { class_level: 'Form 1', class_stream: 'Blue' },
    { class_level: 'Form 2', class_stream: 'Blue' },
  ])
})
