export const LEARNING_FILE_LIMIT = 10 * 1024 * 1024
export const LEARNING_FILE_TYPES = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
}
export const LEARNING_FILE_ACCEPT = Object.keys(LEARNING_FILE_TYPES).map(type => `.${type}`).join(',')
export function validateLearningFile(file) {
  if (!file) throw new Error('Choose a file to upload.')
  const extension = String(file.name).split('.').pop().toLowerCase()
  const mime = LEARNING_FILE_TYPES[extension]
  if (!mime || (file.type && file.type !== mime)) throw new Error('Choose a PDF, Word, PowerPoint, JPG, PNG or WebP file with a matching file type.')
  if (!Number.isFinite(file.size) || file.size < 1 || file.size > LEARNING_FILE_LIMIT) throw new Error('Files must contain data and be no larger than 10 MB.')
  if (!file.name || file.name.length > 240) throw new Error('Use a file name of no more than 240 characters.')
  return { extension, mime_type: mime, size_bytes: file.size, original_name: file.name }
}
export function learningFileSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`
}
const checked = result => {
  if (result.error) throw new Error(result.error.message || 'The school server could not complete this change.')
  return result.data
}
const request = async promise => {
  let timer
  try {
    return checked(await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('The connection took too long. Check your saved notes before retrying.')), 45000)
    })]))
  } finally { clearTimeout(timer) }
}
// Client-generated IDs allow a manual retry to recover a draft whose INSERT response was lost.
export async function saveLearningDetails(client, { id, teacherId, scope, form }) {
  if (!form.title.trim()) throw new Error('Enter a title for these notes.')
  const year = Number(form.academic_year), term = Number(form.term)
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || ![1, 2, 3].includes(term)) throw new Error('Choose an academic year and term.')
  const existing = await request(client.from('learning_resources').select('*').eq('id', id).maybeSingle())
  const details = { title: form.title.trim(), description: form.description.trim() }
  if (existing) {
    if (existing.teacher_id !== teacherId || ['campus', 'class_level', 'class_stream', 'subject'].some(key => (existing[key] || '') !== (scope[key] || ''))) throw new Error('This draft belongs to another teaching allocation. Reopen its original allocation.')
    return request(client.from('learning_resources').update(details).eq('id', id).select('*').single())
  }
  // The SELECT policy resolves this record by ID. INSERT RETURNING evaluates it
  // before the new row is visible to that lookup; read in a separate request.
  await request(client.from('learning_resources').insert({ id, teacher_id: teacherId,
    allocation_id: scope.allocation_id || null, campus: scope.campus, class_level: scope.class_level,
    class_stream: scope.class_stream || '', subject: scope.subject, academic_year: year, term, ...details,
  }))
  return request(client.from('learning_resources').select('*').eq('id', id).single())
}
export async function uploadLearningFile(client, resourceId, file, onProgress = () => {}) {
  const attributes = validateLearningFile(file)
  onProgress('Preparing your file…')
  const reservation = await request(client.from('portal_content_files').insert({ resource_id: resourceId, ...attributes })
    .select('id,bucket_id,object_path').single())
  if (!reservation?.id || !reservation.object_path || reservation.bucket_id !== 'learning-library') throw new Error('The server did not prepare a valid upload. Your existing file is unchanged.')
  onProgress('Uploading your file…')
  // Never overwrite the current file, even when the network response is lost.
  await request(client.storage.from(reservation.bucket_id).upload(reservation.object_path, file, { contentType: attributes.mime_type, upsert: false }))
  onProgress('Checking and saving your file…')
  await request(client.rpc('finalize_portal_content_file', { p_file_id: reservation.id }))
  return reservation
}
export async function changeLearningState(client, id, state) {
  if (!['draft', 'published', 'archived'].includes(state)) throw new Error('Invalid note status.')
  return request(client.from('learning_resources').update({ state }).eq('id', id).select('*').single())
}
export async function learningDownloadLink(client, file) {
  if (!file?.active || !file.ready || file.bucket_id !== 'learning-library') throw new Error('This file is not available yet.')
  const data = await request(client.storage.from(file.bucket_id).createSignedUrl(file.object_path, 60, { download: file.original_name }))
  if (!data?.signedUrl) throw new Error('Could not create the download link. Please try again.')
  return data.signedUrl
}
