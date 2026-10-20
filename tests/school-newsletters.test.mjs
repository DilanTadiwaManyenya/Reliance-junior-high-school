import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acknowledgeNewsletter, newsletterDates, newsletterFileLink, schoolDateInput, uploadNewsletterFile } from '../src/lib/schoolNewsletters.js'

test('school release dates use Zimbabwe time and expiry follows release', () => {
  assert.deepEqual(newsletterDates('2026-11-01T10:30', '2026-11-02T10:30'), { published_at: '2026-11-01T08:30:00.000Z', expires_at: '2026-11-02T08:30:00.000Z' })
  assert.equal(schoolDateInput('2026-11-01T08:30:00Z'), '2026-11-01T10:30')
  assert.throws(() => newsletterDates('2026-11-01T10:30', '2026-10-01T10:30'), /after publication/)
  assert.throws(() => newsletterDates('invalid', ''), /valid school/)
})
test('acknowledgement uses own-user INSERT and accepts only duplicate conflicts', async () => {
  let payload
  const client = code => ({ from: table => { assert.equal(table, 'announcement_reads'); return { insert: async value => { payload = value; return { error: code ? { code } : null } } } } })
  await acknowledgeNewsletter(client('23505'), 'notice')
  assert.deepEqual(payload, { announcement_id: 'notice' })
  await assert.rejects(acknowledgeNewsletter(client('42501'), 'notice'), /Could not mark/)
})
test('newsletter links require finalized newsletter bucket and expire in 60 seconds', async () => {
  let options
  const client = { storage: { from: bucket => { assert.equal(bucket, 'school-newsletters'); return { createSignedUrl: async (...args) => { options = args; return { data: { signedUrl: 'https://example.test/private' } } } } } } }
  const file = { active: true, ready: true, bucket_id: 'school-newsletters', object_path: 'notice/file.pdf', original_name: 'letter.pdf' }
  await newsletterFileLink(client, file)
  assert.deepEqual(options, ['notice/file.pdf', 60, { download: 'letter.pdf' }])
  await assert.rejects(newsletterFileLink(client, { ...file, bucket_id: 'learning-library' }), /no longer available/)
})
test('attachment upload reserves a new newsletter path, never overwrites, then finalizes', async () => {
  const calls = []
  const client = { from: () => ({ insert: payload => { calls.push(payload); return { select: () => ({ single: async () => ({ data: { id: 'file', bucket_id: 'school-newsletters', object_path: 'notice/file.pdf' } }) }) } } }), storage: { from: () => ({ upload: async (...args) => { calls.push(args); return {} } }) }, rpc: async (...args) => { calls.push(args); return {} } }
  await uploadNewsletterFile(client, 'notice', { name: 'letter.pdf', type: 'application/pdf', size: 100 })
  assert.equal(calls[0].announcement_id, 'notice')
  assert.equal(calls[0].resource_id, undefined)
  assert.equal(calls[1][2].upsert, false)
  assert.deepEqual(calls[2], ['finalize_portal_content_file', { p_file_id: 'file' }])
})
