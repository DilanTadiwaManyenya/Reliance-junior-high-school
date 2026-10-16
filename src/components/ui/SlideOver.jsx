import { useId, useRef } from 'react'
import { useModalFocus } from '../../hooks/useModalFocus'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

export default function SlideOver({ open, onClose, title, description, children }) {
  const panelRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  const reducedMotion = useReducedMotion()
  useModalFocus(open, panelRef, onClose)

  return <AnimatePresence>
    {open && <>
      <motion.button className="slideover-backdrop" aria-label="Close panel" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.aside ref={panelRef} tabIndex={-1} className="slideover" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
        initial={{ x: reducedMotion ? 0 : '100%' }} animate={{ x: 0 }} exit={{ x: reducedMotion ? 0 : '100%' }} transition={{ duration: reducedMotion ? 0 : .2, ease: 'easeOut' }}>
        <header className="slideover-header"><div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div><button className="slideover-close" type="button" onClick={onClose} aria-label="Close panel">×</button></header>
        <div className="slideover-body">{children}</div>
      </motion.aside>
    </>}
  </AnimatePresence>
}
