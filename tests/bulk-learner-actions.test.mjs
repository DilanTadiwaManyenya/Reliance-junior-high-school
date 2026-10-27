import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runBulkLearnerAction } from '../src/lib/bulkLearnerActions.js'
const learners = [1, 2, 3].map(id => ({ id: String(id), full_name: `Fixture ${id}`, status: 'inactive' }))
test('bulk deletion uses guarded RPC, deduplicates and reports protected rows', async () => {
  const calls = []
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return { error: args.p_student === '2' ? { message: 'Fee payment history' } : null } } }
  const results = await runBulkLearnerAction(client, [...learners, learners[0]], 'delete', 'Duplicate test records')
  assert.equal(calls.length, 3)
  assert.ok(calls.every(call => call.name === 'manage_disabled_learner' && call.args.p_action === 'delete' && call.args.p_reason === 'Duplicate test records'))
  assert.deepEqual(results.map(row => row.status), ['success', 'blocked', 'success'])
})
test('uncertain responses stop further writes and are never retried', async () => {
  let calls = 0
  const results = await runBulkLearnerAction({ rpc: async () => { calls++; throw new Error('Response lost') } }, learners, 'delete', 'Duplicate test records')
  assert.equal(calls, 1)
  assert.equal(results[0].status, 'unknown')
})
test('invalid status, action and reason reject before any write; disabling uses correction RPC', async () => {
  const calls = []
  const client = { rpc: async (...args) => { calls.push(args); return { error: null } } }
  await assert.rejects(runBulkLearnerAction(client, learners, 'disable', 'Duplicate records'))
  await assert.rejects(runBulkLearnerAction(client, learners, 'delete', 'x'))
  await assert.rejects(runBulkLearnerAction(client, learners, 'other', 'Duplicate records'))
  assert.equal(calls.length, 0)
  await runBulkLearnerAction(client, [{ ...learners[0], status: 'active' }], 'disable', ' Duplicate records ')
  assert.deepEqual(calls, [['correct_assigned_learner', { p_student: '1', p_details: { disable_reason: 'Duplicate records' } }]])
})

test('Supabase transport errors returned as results also stop the batch', async () => {
  let calls = 0
  const results = await runBulkLearnerAction({ rpc: async () => { calls++; return { status: 0, error: { message: 'TypeError: Failed to fetch' } } } }, learners, 'delete', 'Duplicate records')
  assert.equal(calls, 1)
  assert.equal(results[0].status, 'unknown')
})
