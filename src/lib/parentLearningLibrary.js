export const PARENT_LIBRARY_PAGE_SIZE = 20
export function parentLibraryFilters(params) {
  const year = Number(params.get('year')), term = Number(params.get('term')), page = Number(params.get('page'))
  return {
    subject: (params.get('subject') || '').slice(0, 160),
    year: Number.isInteger(year) && year >= 2000 && year <= 2200 ? year : null,
    term: [1, 2, 3].includes(term) ? term : null,
    page: Number.isInteger(page) && page >= 1 && page <= 501 ? page : 1,
  }
}
export async function readParentLibrary(client, studentId, filters, signal) {
  const query = client.rpc('parent_learning_library', {
    p_student_id: studentId, p_subject: filters.subject,
    p_year: filters.year, p_term: filters.term,
    p_offset: (filters.page - 1) * PARENT_LIBRARY_PAGE_SIZE, p_limit: PARENT_LIBRARY_PAGE_SIZE,
  }).abortSignal(signal)
  const { data, error } = await query
  if (error) throw new Error(error.code === '42501'
    ? 'This learner’s library is no longer available to this account. Refresh your learner connections or contact the school office.'
    : 'We could not load the learning library. Check your connection and try again.')
  if (data?.learner?.id !== studentId || !Array.isArray(data.resources) || !Array.isArray(data.subjects) || !Array.isArray(data.years) || !Number.isInteger(data.total_count) || data.total_count < 0) throw new Error('The library response was incomplete. Please retry.')
  if (data.resources.some(row => !row?.id || typeof row.title !== 'string' || !row.file?.id || !row.file.ready || !row.file.active || row.file.bucket_id !== 'learning-library' || !row.file.object_path)) throw new Error('The learning file details were incomplete. Please retry.')
  return data
}
export function canPreviewLearningFile(file) {
  return ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file?.mime_type)
}
export function learningPublicationDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-ZW', { dateStyle: 'medium', timeZone: 'Africa/Harare' }).format(date)
}
export async function parentLearningFileLink(client, file, preview = false, signal) {
  if (!file?.active || !file.ready || file.bucket_id !== 'learning-library' || !file.object_path) throw new Error('This learning file is no longer available. Refresh the library.')
  if (preview && !canPreviewLearningFile(file)) throw new Error('Download this document to open it in a compatible app.')
  const result = client.storage.from('learning-library').createSignedUrl(file.object_path, 60,
    preview ? undefined : { download: file.original_name })
  // Storage signing has no AbortSignal option: callers discard stale results on learner changes.
  let timer
  try {
    const { data, error } = await Promise.race([result, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('The file link took too long. Please try again.')), 15000)
    })])
    if (signal?.aborted) throw new Error('Cancelled file request.')
    if (error || !data?.signedUrl) throw new Error('The file is no longer available, or your connection dropped. Refresh the library and try again.')
    return data.signedUrl
  } finally { clearTimeout(timer) }
}
