import { validateLearningFile } from './learningLibrary.js'

export async function newsletterRequest(query) {
  let timer
  try {
    const result = await Promise.race([query, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('The connection took too long. Refresh to check saved changes before retrying.')), 20000)
    })])
    if (result.error) throw new Error(result.error.message || 'The school server could not complete this request.')
    return result.data
  } finally { clearTimeout(timer) }
}
export function newsletterDates(published, expires) {
  const parse = value => {
    if (!value) return null
    const date = new Date(`${value}:00+02:00`)
    if (Number.isNaN(date.getTime())) throw new Error('Enter a valid school date and time.')
    return date.toISOString()
  }
  const published_at = parse(published), expires_at = parse(expires)
  if (expires_at && new Date(expires_at) <= new Date(published_at || Date.now())) throw new Error('Expiry must be after publication.')
  return { published_at, expires_at }
}
export function schoolDateInput(value) {
  return value ? new Date(new Date(value).getTime() + 7200000).toISOString().slice(0, 16) : ''
}
export async function uploadNewsletterFile(client, id, file) {
  const attributes = validateLearningFile(file)
  const reservation = await newsletterRequest(client.from('portal_content_files').insert({ announcement_id: id, ...attributes }).select('id,bucket_id,object_path').single())
  if (!reservation?.id || reservation.bucket_id !== 'school-newsletters' || !reservation.object_path) throw new Error('The server did not prepare a newsletter upload.')
  await newsletterRequest(client.storage.from('school-newsletters').upload(reservation.object_path, file, { contentType: attributes.mime_type, upsert: false }))
  await newsletterRequest(client.rpc('finalize_portal_content_file', { p_file_id: reservation.id }))
  return { ...reservation, ...attributes, active: true, ready: true }
}
export async function newsletterFileLink(client, file, preview = false) {
  if (!file?.active || !file.ready || file.bucket_id !== 'school-newsletters' || !file.object_path) throw new Error('Refresh this newsletter: its file is no longer available.')
  const data = await newsletterRequest(client.storage.from('school-newsletters').createSignedUrl(file.object_path, 60, preview ? undefined : { download: file.original_name }))
  if (!data?.signedUrl) throw new Error('Could not prepare a private file link.')
  return data.signedUrl
}
export async function acknowledgeNewsletter(client, id) {
  // INSERT only: database policies bind user_id to the signed-in reader.
  const result = await client.from('announcement_reads').insert({ announcement_id: id })
  if (result.error && result.error.code !== '23505') throw new Error('Could not mark this newsletter as read. Please retry.')
}
