// Install before BrowserRouter starts listening, including when pages load lazily.
const guards = new Set()
const protectHistory = event => {
  for (const guard of [...guards].reverse()) {
    guard(event)
    if (event.cancelBubble) break
  }
}
if (typeof window !== 'undefined') window.addEventListener('popstate', protectHistory, true)
if (import.meta.hot) import.meta.hot.dispose(() => {
  if (typeof window !== 'undefined') window.removeEventListener('popstate', protectHistory, true)
  guards.clear()
})

export function registerDraftHistoryGuard(guard) {
  guards.add(guard)
  return () => guards.delete(guard)
}
