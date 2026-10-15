import { useRef } from 'react'
import { useModalFocus } from '../../hooks/useModalFocus'
import { AnimatePresence, motion } from 'framer-motion'

export default function SlideOver({ open, onClose, title, description, children }) {
  const panelRef = useRef(null)
  useModalFocus(open, panelRef, onClose)

  return <AnimatePresence>
    {open && <>
      <motion.button className="slideover-backdrop" aria-label="Close panel" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.aside ref={panelRef} tabIndex={-1} className="slideover" role="dialog" aria-modal="true" aria-labelledby="slideover-title"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: .2, ease: 'easeOut' }}>
        <header className="slideover-header"><div><h2 id="slideover-title">{title}</h2>{description && <p>{description}</p>}</div><button className="slideover-close" type="button" onClick={onClose} aria-label="Close panel">×</button></header>
        <div className="slideover-body">{children}</div>
      </motion.aside>
    </>}
  </AnimatePresence>
}
