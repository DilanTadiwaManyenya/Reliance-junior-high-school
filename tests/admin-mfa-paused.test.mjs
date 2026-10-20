import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('paused admin MFA does not gate protected portal routes', async () => {
  const route = await readFile(new URL('../src/components/portal/ProtectedRoute.jsx', import.meta.url), 'utf8')
  const pause = await readFile(new URL('../supabase/migrations/20261019150000_temporarily_pause_admin_mfa.sql', import.meta.url), 'utf8')

  assert.doesNotMatch(route, /AdminMfaGate|portal_security_settings|aal2/)
  assert.match(route, /if \(!user\) return <Navigate to="\/portal\/login" replace \/>/)
  assert.match(route, /if \(roles && !roles\.includes\(activeRole\)\)/)
  assert.match(pause, /values\(1,false\)/)
})
