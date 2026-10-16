import assert from 'node:assert/strict'
import { test } from 'node:test'
import { invokeEdgeFunction } from '../src/lib/edgeFunction.js'

const fetchError = () => Object.assign(new Error('Failed to send a request to the Edge Function'), { name: 'FunctionsFetchError', context: new TypeError('Failed to fetch') })
function clientFor(results) {
  const calls = []
  return { calls, functions: { async invoke(name, options) {
    calls.push({ name, ...options })
    return results.shift()
  } } }
}

test('Retries the Supabase transport error shown when saving staff names', async () => {
  const client = clientFor([{ data: null, error: fetchError() }, { data: { success: true }, error: null }])
  const body = { action: 'update', legal_full_name: 'Test Teacher' }
  const result = await invokeEdgeFunction(client, 'manage-staff-account', body)
  assert.equal(result.data.success, true)
  assert.equal(client.calls.length, 2)
  assert.equal(client.calls[1].body, body)
  assert.notEqual(client.calls[0].signal, client.calls[1].signal)
})

test('Keeps server validation errors and does not retry them', async () => {
  const client = clientFor([{ data: null, error: {
    name: 'FunctionsHttpError', message: 'Non-2xx response',
    context: new Response(JSON.stringify({ success: false, error: 'Enter the staff member’s full legal name.' }), { status: 400 }),
  } }])
  const result = await invokeEdgeFunction(client, 'manage-staff-account', {})
  assert.match(result.error.message, /full legal name/)
  assert.equal(client.calls.length, 1)
})

test('Bounds retries and tells users to check whether an interrupted save succeeded', async () => {
  const lastError = fetchError()
  const client = clientFor([{ error: fetchError() }, { error: lastError }])
  const result = await invokeEdgeFunction(client, 'manage-staff-account', {})
  assert.equal(client.calls.length, 2)
  assert.match(result.error.message, /confirm whether the change saved/)
  assert.equal(result.error.cause, lastError)
})
