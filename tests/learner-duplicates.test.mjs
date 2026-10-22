import test from 'node:test'
import assert from 'node:assert/strict'
import { learnerNameDistance, possibleLearnerDuplicates } from '../src/lib/learnerDuplicates.js'

test('disabled learners do not block a similar new learner', () => {
  const rows = [
    { id: 'disabled', full_name: 'Atipaishe Manyenya', status: 'inactive' },
    { id: 'active', full_name: 'Atipaishe Manyenyb', status: 'active' },
  ]
  assert.deepEqual(possibleLearnerDuplicates(rows, { full_name: 'Atipaishe Manyenya' }).map(row => row.id), ['active'])
})

test('active learner duplicate warnings remain enabled', () => {
  const matches = possibleLearnerDuplicates(
    [{ id: 'existing', full_name: 'Tariro Moyo', status: 'active' }],
    { full_name: 'Tariro Moyo' },
  )
  assert.equal(matches.length, 1)
  assert.equal(matches[0].id, 'existing')
})

test('name matching handles four edits, accents, case and reversed name order', () => {
  assert.equal(learnerNameDistance('Jane Chipo', 'CHIPO Jane'), 0)
  assert.equal(learnerNameDistance('José Banda', 'Jose Banda'), 0)
  assert.equal(learnerNameDistance('abcdefgh', 'abcdwxyz'), 4)
  assert.equal(possibleLearnerDuplicates([{ id: 'a', full_name: 'abcdefgh' }, { id: 'b', full_name: 'zzzzzzzzzzzz' }], { full_name: 'abcdwxyz' }).length, 1)
  assert.deepEqual(possibleLearnerDuplicates([{ full_name: 'Jane' }], { full_name: '' }), [])
})
