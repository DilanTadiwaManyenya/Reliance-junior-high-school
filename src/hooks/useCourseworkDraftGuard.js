import { registerDraftHistoryGuard } from '../lib/draftHistoryGuard'
import { useEffect, useRef } from 'react'

const buttons = '.sidebar-nav-item, .teacher-workspace-switch button, .coursework-back, .library-back, .teacher-subject-navigation button, .top-bar-back, .teacher-workspace-return button, .top-bar-logout, .top-bar-site-link'
const selects = '.coursework-heading select, [data-draft-navigation], .top-bar-role-switcher select, .top-bar-class-control select'

export function useCourseworkDraftGuard(dirty, saving, message = 'You have unsaved coursework marks. Leave this view and discard those changes?') {
  const historyPosition = useRef({ index: null, restoring: false })
  useEffect(() => {
    const position = historyPosition.current
    if (!position.restoring) position.index = window.history.state?.idx
    if (!dirty && !saving) return
    const previous = new WeakMap()
    document.querySelectorAll(selects).forEach(select => previous.set(select, select.value))
    const protect = event => {
      const target = event.target.closest(event.type === 'change' ? selects : buttons)
      if (!target) return
      if (saving || !window.confirm(message)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (target.tagName === 'SELECT' && previous.has(target)) target.value = previous.get(target)
      } else if (target.tagName === 'SELECT') previous.set(target, target.value)
    }
    // BrowserRouter indexes its own entries. Cancel a same-document traversal
    // before the router replaces this draft, then return to that entry.
    // Use go(), not pushState(), so cancelling preserves Back/Forward history.
    const protectHistory = event => {
      const nextIndex = event.state?.idx
      if (!Number.isInteger(position.index) || !Number.isInteger(nextIndex)) return
      if (position.restoring) {
        event.stopImmediatePropagation()
        if (nextIndex === position.index) position.restoring = false
        else window.history.go(position.index - nextIndex)
        return
      }
      if (nextIndex === position.index) return
      if (saving || !window.confirm(message)) {
        event.stopImmediatePropagation()
        position.restoring = true
        window.history.go(position.index - nextIndex)
      } else position.index = nextIndex
    }
    const beforeUnload = event => { event.preventDefault(); event.returnValue = '' }
    document.addEventListener('click', protect, true)
    document.addEventListener('change', protect, true)
    const unregisterHistory = registerDraftHistoryGuard(protectHistory)
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      document.removeEventListener('click', protect, true)
      document.removeEventListener('change', protect, true)
      unregisterHistory()
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [dirty, saving, message])
}
