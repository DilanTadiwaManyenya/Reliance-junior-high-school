const EDGE_TIMEOUT_MS = 15_000

const isRetryableNetworkError = (error) => {
  const message = String(error?.message ?? error ?? '').toLowerCase()
  return ['AbortError', 'FunctionsFetchError', 'FunctionsRelayError'].includes(error?.name)
    || /network|fetch|timeout|timed out|failed to send a request|load failed/.test(message)
}

const invokeOnce = async (supabase, name, body) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS)
  try {
    const result = await supabase.functions.invoke(name, { body, signal: controller.signal })
    if (!result.error?.context) return result
    try {
      const response = result.error.context.clone()
      const rawDetails = await response.text()
      const details = rawDetails ? JSON.parse(rawDetails) : {}
      return { ...result, data: details, error: new Error(details.error || details.message || result.error.message) }
    } catch { return result }
  } finally { clearTimeout(timer) }
}

const invokeSafely = async (...args) => {
  try { return await invokeOnce(...args) } catch (error) { return { data: null, error } }
}

export const invokeEdgeFunction = async (supabase, name, body) => {
  const first = await invokeSafely(supabase, name, body)
  const result = first.error && isRetryableNetworkError(first.error)
    ? await invokeSafely(supabase, name, body)
    : first
  if (result.error && isRetryableNetworkError(result.error)) {
    return {
      ...result,
      error: new Error('Unable to reach the school server. Check your connection, then reload the staff list to confirm whether the change saved before trying again.', { cause: result.error }),
    }
  }
  return result
}
