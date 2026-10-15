import { useEffect, useRef } from 'react'

let openDialogs = 0
let originalOverflow = ''

// Keep focus and scrolling inside a modal, including mobile navigation drawers.
export function useModalFocus(open, rootRef, onClose) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!open || !rootRef.current) return undefined
    const root = rootRef.current
    const previousFocus = document.activeElement
    if (openDialogs++ === 0) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    const focusable = () => [...root.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')].filter(element => element.getClientRects().length > 0)
    const focusInside = () => { if (!root.contains(document.activeElement)) (focusable()[0] || root).focus() }
    const frame = requestAnimationFrame(focusInside)
    root.addEventListener('transitionend', focusInside)
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0]
      const last = items.at(-1)
      if (!first) { event.preventDefault(); root.focus(); return }
      if (!root.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }
    root.addEventListener('keydown', keydown)
    return () => {
      cancelAnimationFrame(frame)
      root.removeEventListener('keydown', keydown)
      root.removeEventListener('transitionend', focusInside)
      if (--openDialogs === 0) document.body.style.overflow = originalOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open, rootRef])
}
