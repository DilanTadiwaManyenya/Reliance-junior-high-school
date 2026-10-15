import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchPortalProfile } from '../src/lib/portalProfile.js'

function clientFor(results) {
  const selections = []
  return {
    selections,
    from() { return {
      select(columns) { selections.push(columns); return this },
      eq() { return this }, single() { return this },
      abortSignal() { const result = results.shift(); return typeof result === 'function' ? result() : Promise.resolve(result) },
    } },
  }
}
test('Loads a profile with its role and teaching assignments', async () => {
  const profile = { id: 'staff', role: 'admin', active_role: 'teacher', teacher_class_assignments: [{ class_level: 'Form 1' }] }
  const client = clientFor([{ data: profile }])
  assert.deepEqual(await fetchPortalProfile(client, 'staff'), { profile, error: null })
  assert.equal(client.selections.length, 1)
})
test('Falls back when optional assignment joins are unavailable', async () => {
  const profile = { role: 'parent' }
  const client = clientFor([{ error: new Error('Missing relation') }, { data: profile }])
  assert.deepEqual(await fetchPortalProfile(client, 'parent'), { profile, error: null })
  assert.equal(client.selections[1], '*')
})
test('Returns recoverable errors for rejected queries and missing profiles', async () => {
  for (const results of [
    [{ error: new Error('Denied') }, { error: new Error('Denied') }],
    [{ data: null }],
    [() => Promise.reject(new Error('Network unavailable'))],
  ]) {
    const result = await fetchPortalProfile(clientFor(results), 'staff')
    assert.equal(result.profile, null)
    assert.ok(result.error)
  }
})
test('Settles a stalled profile request so the route can offer retry', async () => {
  const result = await fetchPortalProfile(clientFor([() => new Promise(() => {})]), 'staff', 10)
  assert.equal(result.profile, null)
  assert.match(result.error.message, /timed out/)
})
