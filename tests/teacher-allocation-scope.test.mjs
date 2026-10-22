import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchesTeacherSubjectAllocation } from '../src/lib/teacherAllocationScope.js'

const allocation = { campus: 'senior', class_level: 'Upper Six', class_stream: 'Commercials', subject: 'Accounting' }

test('subject allocation matching keeps Senior learners in their assigned stream and campus', () => {
  assert.equal(matchesTeacherSubjectAllocation({ campus: 'senior', class_level: 'Upper Six', class_stream: 'Commercials' }, allocation), true)
  assert.equal(matchesTeacherSubjectAllocation({ campus: 'senior', class_level: 'Upper Six', class_stream: 'Arts' }, allocation), false)
  assert.equal(matchesTeacherSubjectAllocation({ campus: 'junior', class_level: 'Upper Six', class_stream: 'Commercials' }, allocation), false)
  assert.equal(matchesTeacherSubjectAllocation({ class_level: 'Upper Six', class_stream: 'Commercials' }, allocation), false)
  assert.equal(matchesTeacherSubjectAllocation({ campus: 'senior', class_level: 'Lower Six', class_stream: 'Commercials' }, allocation), false)
})

test('an explicitly whole-form allocation includes each stream only at its campus and level', () => {
  const wholeForm = { ...allocation, class_stream: '' }
  assert.equal(matchesTeacherSubjectAllocation({ campus: 'senior', class_level: 'Upper Six', class_stream: 'Arts' }, wholeForm), true)
  assert.equal(matchesTeacherSubjectAllocation({ campus: 'junior', class_level: 'Upper Six', class_stream: 'Arts' }, wholeForm), false)
})
