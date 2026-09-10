const EDGE_TIMEOUT_MS = 15_000

const isRetryableNetworkError = (error) => {
  const message = String(error?.message ?? error ?? '').toLowerCase()
  return error?.name === 'AbortError' || /network|fetch|timeout|timed out|failed to fetch|load failed/.test(message)
}

const invokeOnce = async (supabase, name, body) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS)
  try {
    const result = await supabase.functions.invoke(name, { body, signal: controller.signal })
    if (!result.error?.context) return result
    try {
      const details = await result.error.context.clone().json()
      return { ...result, data: details, error: new Error(details.error || details.message || result.error.message) }
    } catch { return result }
  } finally { clearTimeout(timer) }
}

const invokeSafely = async (...args) => {
  try { return await invokeOnce(...args) } catch (error) { return { data: null, error } }
}

export const invokeEdgeFunction = async (supabase, name, body) => {
  const first = await invokeSafely(supabase, name, body)
  return first.error && isRetryableNetworkError(first.error) ? invokeSafely(supabase, name, body) : first
}