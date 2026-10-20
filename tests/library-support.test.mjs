import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readContentTrace, readLibrarySupport, supportAvailability, supportFileLink } from '../src/lib/librarySupport.js'
test('support listing sends explicit bounded filters and rejects mismatched scope', async () => {
  let sent
  const client = response => ({ rpc: (name, args) => { sent = { name, args }; return { abortSignal: () => Promise.resolve({ data: response }) } } })
  const filters = { campus: 'junior', kind: 'notes', state: 'draft', level: 'Grade 5', search: ' Maths ', page: 1 }
  await readLibrarySupport(client({ campus: 'junior', kind: 'notes', items: [], levels: [], total_count: 0 }), filters)
  assert.deepEqual(sent.args, { p_campus: 'junior', p_kind: 'notes', p_state: 'draft', p_level: 'Grade 5', p_search: 'Maths', p_offset: 20, p_limit: 20 })
  await assert.rejects(readLibrarySupport(client({ campus: 'senior', kind: 'notes', items: [], levels: [], total_count: 0 }), filters), /incomplete/)
})
test('activity responses must match the requested content', async () => {
  const client = { rpc: () => ({ abortSignal: () => Promise.resolve({ data: { content_id: 'wrong', events: [], total_count: 0 } }) }) }
  await assert.rejects(readContentTrace(client, 'notes', 'requested', 0), /incomplete/)
})
test('visibility labels distinguish draft, schedule, expiry, missing file and staff audience', () => {
  const now = Date.parse('2026-10-20T10:00:00Z')
  const row = { state: 'published', published_at: '2026-10-19T10:00:00Z', file: {} }
  assert.match(supportAvailability({ ...row, state: 'draft' }, 'notes', now), /draft/)
  assert.match(supportAvailability({ ...row, published_at: '2026-10-21T10:00:00Z' }, 'notes', now), /Scheduled/)
  assert.match(supportAvailability({ ...row, expires_at: '2026-10-20T09:00:00Z' }, 'newsletters', now), /Expired/)
  assert.match(supportAvailability({ ...row, audience: 'staff' }, 'newsletters', now), /Staff only/)
  assert.match(supportAvailability({ ...row, file: null }, 'notes', now), /No ready/)
  assert.match(supportAvailability(row, 'notes', now), /Published/)
})
test('file requests stay within the content type bucket', async () => {
  const file = { active: true, ready: true, bucket_id: 'school-newsletters', object_path: 'notice/file.pdf' }
  await assert.rejects(supportFileLink({}, 'notes', file, false), /no longer available/)
  assert.throws(() => supportFileLink({}, 'unknown', file, false), /supported/)
})
