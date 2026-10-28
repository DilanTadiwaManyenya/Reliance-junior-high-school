import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolvePortalDestination } from '../src/lib/portalRedirect.js'

function clientFor(result) {
  const selections = []
  return {
    selections,
    from(table) {
      assert.equal(table, 'profiles')
      return {
        select(columns) {
          selections.push(columns)
          return this
        },
        eq(column, value) {
          assert.equal(column, 'id')
          assert.equal(value, 'user-1')
          return this
        },
        async single() { return result },
      }
    },
  }
}

test('Staff accounts are rejected from the parent sign-in page', async () => {
  const client = clientFor({ data: { role: 'admin', active_role: 'admin', must_change_password: false, user_roles: [{ role: 'admin' }] } })
  const result = await resolvePortalDestination(client, 'user-1', null, 'parent')
  assert.equal(result.destination, null)
  assert.equal(result.portalMismatch, true)
  assert.equal(client.selections.length, 1)
  assert.equal(client.selections[0], 'role, active_role, must_change_password, user_roles(role)')
})

test('A staff identity with a stale parent active role cannot use the parent sign-in page', async () => {
  const result = await resolvePortalDestination(clientFor({ data: {
    role: 'admin', active_role: 'parent', user_roles: [{ role: 'parent' }, { role: 'admin' }],
  } }), 'user-1', null, 'parent')
  assert.equal(result.destination, null)
  assert.equal(result.portalMismatch, true)
})

test('A mixed-role staff identity selects its staff workspace from the staff sign-in page', async () => {
  const result = await resolvePortalDestination(clientFor({ data: {
    role: 'teacher', active_role: 'parent', user_roles: [{ role: 'parent' }, { role: 'teacher' }],
  } }), 'user-1', null, 'staff')
  assert.equal(result.destination, '/portal/teacher')
  assert.equal(result.portalMismatch, false)
})

test('Parent accounts are rejected from the staff sign-in page', async () => {
  const result = await resolvePortalDestination(clientFor({ data: { role: 'parent', active_role: 'parent', user_roles: [{ role: 'parent' }] } }), 'user-1', null, 'staff')
  assert.equal(result.destination, null)
  assert.equal(result.portalMismatch, true)
})

test('Routes a staff account to its assigned workspace when the requested portal is staff', async () => {
  const client = clientFor({ data: { role: 'admin', active_role: 'admin', must_change_password: false, user_roles: [{ role: 'admin' }] } })
  const result = await resolvePortalDestination(client, 'user-1', null, 'staff')
  assert.equal(result.destination, '/portal/staff')
  assert.equal(client.selections.length, 1)
  assert.equal(client.selections[0], 'role, active_role, must_change_password, user_roles(role)')
})

test('Routes parents to the parent portal and preserves required password changes', async () => {
  const parent = await resolvePortalDestination(clientFor({ data: { role: 'parent', active_role: 'parent' } }), 'user-1')
  assert.equal(parent.destination, '/portal/dashboard')

  const passwordChange = await resolvePortalDestination(clientFor({ data: { role: 'teacher', active_role: 'teacher', must_change_password: true } }), 'user-1')
  assert.equal(passwordChange.destination, '/portal/set-password')
})

test('Returns profile lookup errors without inventing a portal role', async () => {
  const failure = new Error('Network unavailable')
  const result = await resolvePortalDestination(clientFor({ data: null, error: failure }), 'user-1')
  assert.equal(result.destination, null)
  assert.equal(result.error, failure)
})

test('Does not trust an active role unless it is assigned to the account', async () => {
  const result = await resolvePortalDestination(clientFor({ data: {
    role: 'parent', active_role: 'teacher', user_roles: [{ role: 'parent' }],
  } }), 'user-1', null, 'staff')
  assert.equal(result.destination, null)
  assert.equal(result.portalMismatch, true)
})
