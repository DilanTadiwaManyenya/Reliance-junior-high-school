import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changeLearningState, LEARNING_FILE_LIMIT, learningDownloadLink, saveLearningDetails, uploadLearningFile, validateLearningFile } from '../src/lib/learningLibrary.js'

const pdf = { name: 'lesson.pdf', type: 'application/pdf', size: 120 }
const scope = { campus: 'senior', class_level: 'Form 1', class_stream: '', subject: 'Mathematics', allocation_id: 'allocation' }
const form = { title: ' Fractions ', description: ' Revision ', academic_year: '2026', term: '3' }
function mock({ existing = null, failUpload = false, failFinalize = false } = {}) {
  const calls = []
  const state = { row: existing }
  const client = {
    from(table) {
      let action = 'select', payload
      const query = {
        select() { return query }, eq() { return query },
        insert(value) { action = 'insert'; payload = value; return query },
        update(value) { action = 'update'; payload = value; return query },
        async single() {
          calls.push({ table, action, payload })
          if (table === 'portal_content_files') return { data: { id: 'file', bucket_id: 'learning-library', object_path: 'resource/file.pdf' } }
          state.row = { ...state.row, ...payload }
          return { data: state.row }
        },
        async maybeSingle() { calls.push({ table, action }); return { data: state.row } },
      }
      return query
    },
    storage: { from(bucket) { return {
      async upload(path, file, options) { calls.push({ upload: true, bucket, path, file, options }); return failUpload ? { error: { message: 'Upload disconnected' } } : { data: { path } } },
      async createSignedUrl(path, seconds, options) { calls.push({ bucket, path, seconds, options }); return { data: { signedUrl: 'https://example.test/private-file' } } },
    } } },
    async rpc(name, payload) { calls.push({ rpc: name, payload }); return failFinalize ? { error: { message: 'File verification failed' } } : { data: null } },
  }
  return { client, calls, state }
}
test('file validation enforces exact size, extension and MIME limits', () => {
  assert.equal(validateLearningFile({ ...pdf, size: LEARNING_FILE_LIMIT }).size_bytes, LEARNING_FILE_LIMIT)
  assert.equal(validateLearningFile({ ...pdf, name: 'LESSON.PDF', type: '' }).mime_type, 'application/pdf')
  for (const bad of [{ ...pdf, size: 0 }, { ...pdf, size: LEARNING_FILE_LIMIT + 1 }, { ...pdf, name: 'lesson.svg' }, { ...pdf, type: 'text/html' }]) assert.throws(() => validateLearningFile(bad))
})
test('upload reserves a new private path and finalizes only after bytes succeed', async () => {
  const { client, calls } = mock()
  await uploadLearningFile(client, 'resource', pdf)
  assert.equal(calls[0].table, 'portal_content_files')
  assert.equal(calls[0].payload.resource_id, 'resource')
  assert.equal(calls[0].payload.ready, undefined)
  assert.equal(calls[1].bucket, 'learning-library')
  assert.equal(calls[1].options.upsert, false)
  assert.equal(calls[1].options.contentType, 'application/pdf')
  assert.equal(calls[2].rpc, 'finalize_portal_content_file')
})
test('failed upload never finalizes or overwrites the current file', async () => {
  const { client, calls } = mock({ failUpload: true })
  await assert.rejects(uploadLearningFile(client, 'resource', pdf), /disconnected/)
  assert.equal(calls.filter(call => call.rpc).length, 0)
  assert.equal(calls.find(call => call.upload).options.upsert, false)
})
test('finalization errors propagate instead of reporting saved file success', async () => {
  const { client } = mock({ failFinalize: true })
  await assert.rejects(uploadLearningFile(client, 'resource', pdf), /verification failed/)
})
test('new drafts retain a stable ID; an uncertain create can be recovered on retry', async () => {
  const { client, calls, state } = mock()
  await saveLearningDetails(client, { id: 'stable-id', teacherId: 'teacher', scope, form })
  assert.equal(state.row.id, 'stable-id')
  assert.equal(state.row.class_stream, '')
  assert.equal(state.row.title, 'Fractions')
  await saveLearningDetails(client, { id: 'stable-id', teacherId: 'teacher', scope, form: { ...form, title: 'Updated' } })
  assert.equal(calls.filter(call => call.action === 'insert').length, 1)
  const update = calls.find(call => call.action === 'update')
  assert.deepEqual(Object.keys(update.payload).sort(), ['description', 'title'])
})
test('editing cannot switch author or teaching scope', async () => {
  const { client } = mock({ existing: { id: 'resource', teacher_id: 'teacher', ...scope } })
  await assert.rejects(saveLearningDetails(client, { id: 'resource', teacherId: 'other', scope, form }), /another teaching allocation/)
  await assert.rejects(saveLearningDetails(client, { id: 'resource', teacherId: 'teacher', scope: { ...scope, subject: 'History' }, form }), /another teaching allocation/)
})
test('only finalized active files get short-lived private download links', async () => {
  const { client, calls } = mock()
  await assert.rejects(learningDownloadLink(client, { ready: false }), /not available/)
  await learningDownloadLink(client, { active: true, ready: true, bucket_id: 'learning-library', object_path: 'resource/file.pdf', original_name: 'lesson.pdf' })
  assert.equal(calls[0].seconds, 60)
  assert.equal(calls[0].options.download, 'lesson.pdf')
})
test('resource state changes do not permanently delete notes', async () => {
  const { client, calls } = mock({ existing: { id: 'resource' } })
  await changeLearningState(client, 'resource', 'archived')
  assert.deepEqual(calls[0].payload, { state: 'archived' })
  await assert.rejects(changeLearningState(client, 'resource', 'deleted'), /Invalid/)
})
