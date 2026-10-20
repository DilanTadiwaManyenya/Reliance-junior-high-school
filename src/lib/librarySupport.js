import { newsletterRequest, newsletterFileLink } from './schoolNewsletters.js'
import { parentLearningFileLink } from './parentLearningLibrary.js'

export async function readLibrarySupport(client, filters, signal) {
  const result = await newsletterRequest(client.rpc('school_library_oversight', {
    p_campus: filters.campus, p_kind: filters.kind, p_state: filters.state,
    p_level: filters.level, p_search: filters.search.trim().slice(0, 160),
    p_offset: filters.page * 20, p_limit: 20,
  }).abortSignal(signal))
  if (result?.campus !== filters.campus || result.kind !== filters.kind || !Array.isArray(result.items)
    || !Array.isArray(result.levels) || !Number.isInteger(result.total_count)) throw new Error('The support response was incomplete. Please retry.')
  return result
}
export async function readContentTrace(client, kind, id, page, signal) {
  const result = await newsletterRequest(client.rpc('school_content_trace', { p_kind: kind, p_id: id, p_offset: page * 20, p_limit: 20 }).abortSignal(signal))
  if (result?.content_id !== id || !Array.isArray(result.events) || !Number.isInteger(result.total_count)) throw new Error('The activity response was incomplete. Please retry.')
  return result
}
export function supportFileLink(client, kind, file, preview) {
  if (!['notes', 'newsletters'].includes(kind)) throw new Error('Choose a supported content type.')
  return kind === 'notes' ? parentLearningFileLink(client, file, preview) : newsletterFileLink(client, file, preview)
}
export function supportAvailability(row, kind, now = Date.now()) {
  if (row.state !== 'published') return `Hidden from parents: ${row.state}`
  if (!row.published_at || new Date(row.published_at).getTime() > now) return 'Scheduled: not yet visible to parents'
  if (kind === 'newsletters' && row.expires_at && new Date(row.expires_at).getTime() <= now) return 'Expired: hidden from parents'
  if (kind === 'newsletters' && row.audience === 'staff') return 'Staff only: hidden from parents'
  if (kind === 'notes' && !row.file) return 'No ready attachment: hidden from parent library'
  return 'Published for eligible linked learners'
}
