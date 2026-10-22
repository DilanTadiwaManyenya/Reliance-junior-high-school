import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canonicalizeClassLevel, getCampusForLevel, isJuniorLevel, isSeniorLevel } from '../src/data/classOptions.js'

test('class aliases resolve to one canonical portal label', () => {
  for (const level of ['lower 6', 'Lower 6', 'Form 5', 'form5', ' lower   six ']) assert.equal(canonicalizeClassLevel(level), 'Lower Six')
  for (const level of ['upper 6', 'Upper 6', 'Form 6', 'form6', ' UPPER SIX ']) assert.equal(canonicalizeClassLevel(level), 'Upper Six')
  assert.equal(canonicalizeClassLevel('gRaDe   4'), 'Grade 4')
  assert.equal(isSeniorLevel('Form 5'), true)
  assert.equal(isSeniorLevel('UPPER 6'), true)
  assert.equal(isJuniorLevel('grade 4'), true)
  assert.equal(getCampusForLevel('form 5'), 'senior')
})
