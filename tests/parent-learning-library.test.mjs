import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canPreviewLearningFile, learningPublicationDate, parentLearningFileLink, parentLibraryFilters, readParentLibrary } from '../src/lib/parentLearningLibrary.js'

const file = { id: 'file', bucket_id: 'learning-library', object_path: 'resource/file.pdf', active: true, ready: true, mime_type: 'application/pdf', original_name: 'lesson.pdf' }
const response = { learner: { id: 'learner' }, resources: [{ id: 'resource', title: 'Notes', file }], subjects: ['Mathematics'], years: [2026], total_count: 1 }
test('URL filters are bounded and invalid numeric values use safe defaults', () => {
  assert.deepEqual(parentLibraryFilters(new URLSearchParams('subject=Mathematics&year=2026&term=3&page=2')), { subject: 'Mathematics', year: 2026, term: 3, page: 2 })
  assert.deepEqual(parentLibraryFilters(new URLSearchParams('year=NaN&term=99&page=-1')), { subject: '', year: null, term: null, page: 1 })
  assert.equal(parentLibraryFilters(new URLSearchParams('page=502')).page, 1)
})
test('listing passes only a selected learner and bounded filters, not client-supplied class/campus', async () => {
  let captured
  const client = { rpc(name, args) { captured = { name, args }; return { abortSignal: () => Promise.resolve({ data: response }) } } }
  const result = await readParentLibrary(client, 'learner', { subject: '', year: null, term: 3, page: 2 }, new AbortController().signal)
  assert.equal(result, response)
  assert.deepEqual(captured, { name: 'parent_learning_library', args: { p_student_id: 'learner', p_subject: '', p_year: null, p_term: 3, p_offset: 20, p_limit: 20 } })
})
test('wrong learner and incomplete file metadata never render as a successful read', async () => {
  const client = data => ({ rpc: () => ({ abortSignal: () => Promise.resolve({ data }) }) })
  await assert.rejects(readParentLibrary(client(response), 'different', { page: 1 }), /incomplete/)
  await assert.rejects(readParentLibrary(client({ ...response, resources: [{ id: 'row', title: 'Notes' }] }), 'learner', { page: 1 }), /incomplete/)
  await assert.rejects(readParentLibrary({ rpc: () => ({ abortSignal: () => Promise.resolve({ error: { code: '42501' } }) }) }, 'learner', { page: 1 }), /no longer available/)
})
test('only PDF and supported images are previewed', () => {
  assert.equal(canPreviewLearningFile(file), true)
  assert.equal(canPreviewLearningFile({ mime_type: 'image/png' }), true)
  assert.equal(canPreviewLearningFile({ mime_type: 'text/html' }), false)
  assert.equal(canPreviewLearningFile({ mime_type: 'application/msword' }), false)
})
test('downloads use a private 60-second link and attachment mode; previews do not force download', async () => {
  const calls = []
  const client = { storage: { from(bucket) { return { async createSignedUrl(path, duration, options) { calls.push({ bucket, path, duration, options }); return { data: { signedUrl: 'https://example.test/private' } } } } } } }
  await parentLearningFileLink(client, file)
  await parentLearningFileLink(client, file, true)
  assert.equal(calls[0].bucket, 'learning-library')
  assert.equal(calls[0].duration, 60)
  assert.deepEqual(calls[0].options, { download: 'lesson.pdf' })
  assert.equal(calls[1].options, undefined)
  await assert.rejects(parentLearningFileLink(client, { ...file, active: false }), /no longer available/)
})
test('a cancelled file request rejects its late result', async () => {
  const controller = new AbortController()
  const client = { storage: { from() { return { async createSignedUrl() { controller.abort(); return { data: { signedUrl: 'https://example.test/late' } } } } } } }
  await assert.rejects(parentLearningFileLink(client, file, false, controller.signal), /Cancelled/)
})
test('publication dates follow the school timezone and tolerate missing/invalid dates', () => {
  assert.match(learningPublicationDate('2026-10-20T23:30:00Z'), /21/)
  assert.equal(learningPublicationDate('invalid'), '')
  assert.equal(learningPublicationDate(null), '')
})
