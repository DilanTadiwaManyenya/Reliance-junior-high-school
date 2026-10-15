const PROFILE_TIMEOUT_MS = 12_000

// Bound both profile queries together so unavailable profile services cannot
// strand a valid session on the loading screen.
export async function fetchPortalProfile(client, userId, timeoutMs = PROFILE_TIMEOUT_MS) {
  const controller = new AbortController()
  let timer
  try {
    const query = async () => {
      const detailed = await client.from('profiles').select('*, user_roles(role), teacher_class_assignments(class_level, class_stream), teacher_class_subject_assignments(id, class_level, class_stream, subject, campus)').eq('id', userId).single().abortSignal(controller.signal)
      const result = detailed.error
        ? await client.from('profiles').select('*').eq('id', userId).single().abortSignal(controller.signal)
        : detailed
      if (result.error) throw result.error
      if (!result.data) throw new Error('Your portal profile could not be found.')
      return { profile: result.data, error: null }
    }
    return await Promise.race([
      query(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error('Loading your portal access timed out. Please try again.'))
        }, timeoutMs)
      }),
    ])
  } catch (error) {
    return { profile: null, error }
  } finally { clearTimeout(timer) }
}
