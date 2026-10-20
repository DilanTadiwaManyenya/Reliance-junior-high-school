import test from 'node:test'
import assert from 'node:assert/strict'
import { needsExpenseCampusChoice, resolveExpenseCampus } from '../src/lib/expenseCampus.js'

test('school-wide admin must choose an expense campus instead of defaulting to Junior', () => {
  assert.equal(needsExpenseCampusChoice('admin', 'all'), true)
  assert.equal(resolveExpenseCampus('admin', 'all', ''), null)
  assert.equal(resolveExpenseCampus('admin', 'all', 'senior'), 'senior')
  assert.equal(resolveExpenseCampus('admin', 'all', 'invalid'), null)
})

test('an assigned campus controls expense attribution for non-school-wide staff', () => {
  assert.equal(needsExpenseCampusChoice('accountant', 'senior'), false)
  assert.equal(resolveExpenseCampus('accountant', 'senior', 'junior'), 'senior')
  assert.equal(resolveExpenseCampus('admin', 'junior', 'senior'), 'junior')
  assert.equal(resolveExpenseCampus('accountant', null, 'senior'), null)
})
