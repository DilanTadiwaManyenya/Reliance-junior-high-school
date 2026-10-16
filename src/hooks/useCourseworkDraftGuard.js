import { useEffect } from 'react'

const buttons = '.sidebar-nav-item, .teacher-workspace-switch button, .coursework-back, .top-bar-back, .teacher-workspace-return button, .top-bar-logout, .top-bar-site-link'
const selects = '.coursework-heading select, [data-draft-navigation], .top-bar-role-switcher select, .top-bar-class-control select'

export function useCourseworkDraftGuard(dirty, saving) {
  useEffect(() => {
    if (!dirty && !saving) return
    const previous = new WeakMap()
    document.querySelectorAll(selects).forEach(select => previous.set(select, select.value))
    const protect = event => {
      const target = event.target.closest(event.type === 'change' ? selects : buttons)
      if (!target) return
      if (saving || !window.confirm('You have unsaved coursework marks. Leave this view and discard those changes?')) {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (target.tagName === 'SELECT' && previous.has(target)) target.value = previous.get(target)
      } else if (target.tagName === 'SELECT') previous.set(target, target.value)
    }
    const beforeUnload = event => { event.preventDefault(); event.returnValue = '' }
    document.addEventListener('click', protect, true)
    document.addEventListener('change', protect, true)
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      document.removeEventListener('click', protect, true)
      document.removeEventListener('change', protect, true)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [dirty, saving])
}
