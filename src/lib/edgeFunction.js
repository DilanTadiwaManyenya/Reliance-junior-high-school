const EDGE_TIMEOUT_MS = 15_000

const isRetryableNetworkError = (error) => {
  const message = String(error?.message ?? error ?? '').toLowerCase()
  return error?.name === 'AbortError' || /network|fetch|timeout|timed out|failed to fetch|load failed/.test(message)
}

const invokeOnce = async (supabase, name, body) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS)
  try { return await supabase.functions.invoke(name, { body, signal: controller.signal }) } finally { clearTimeout(timer) }
}

const invokeSafely = async (...args) => {
  try { return await invokeOnce(...args) } catch (error) { return { data: null, error } }
}

// Validation and function-returned errors are deliberately not retried.
export const invokeEdgeFunction = async (supabase, name, body) => {
  const first = await invokeSafely(supabase, name, body)
  return first.error && isRetryableNetworkError(first.error) ? invokeSafely(supabase, name, body) : first
}
