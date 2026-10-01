import { createContext, useContext, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import PortalSidebar from './PortalSidebar'
import StaffTopBar from './StaffTopBar'
import { useAuth } from '../../context/useAuth'

/* ── Section context shared with child pages ─────────────────────── */
export const SectionContext = createContext({ 
  section: 'dashboard', 
  setSection: () => {},
  goBack: () => {},
  canGoBack: false,
  activeClassKey: '',
  setActiveClassKey: () => {},
  activeClassFilter: { level: null, stream: null },
  setActiveClassFilter: () => {}
})
export const useSection = () => useContext(SectionContext)

export default function StaffPortalLayout() {
  const { profile } = useAuth()
  const [section, setSection]         = useState('dashboard')
  const [sectionHistory, setSectionHistory] = useState([])
  const [collapsed, setCollapsed]     = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [activeClassKey, setActiveClassKey] = useState('')
  const [activeClassFilter, setActiveClassFilter] = useState({ level: null, stream: null })

  const toggleCollapse = () => setCollapsed(c => !c)
  const toggleMobile   = () => setMobileOpen(o => !o)
  const closeMobile    = () => setMobileOpen(false)
  const changeSection = nextSection => {
    if (section === nextSection) return
    setSectionHistory(history => [...history, section])
    setSection(nextSection)
  }
  const goBack = () => {
    const previous = sectionHistory.at(-1)
    if (!previous) return
    setSection(previous)
    setSectionHistory(history => history.slice(0, -1))
  }

  return (
    <SectionContext.Provider value={{ section, setSection: changeSection, goBack, canGoBack: sectionHistory.length > 0, activeClassKey, setActiveClassKey, activeClassFilter, setActiveClassFilter }}>
      <div className={`staff-shell${collapsed ? ' sidebar-collapsed' : ''}${profile?.role === 'accountant' ? ' no-sidebar' : ''}`}>

        {/* ── Top header bar ─────────────────────── */}
        <StaffTopBar
          onToggleSidebar={toggleCollapse}
          onToggleMobile={toggleMobile}
        />

        {/* ── Mobile overlay backdrop ─────────────── */}
        <AnimatePresence>
          {mobileOpen && profile?.role !== 'accountant' && (
            <motion.div
              className="sidebar-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeMobile}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        {/* ── Sidebar ────────────────────────────── */}
        <AnimatePresence>
          {profile?.role !== 'accountant' && (
            <motion.div
              className={`sidebar-wrapper${mobileOpen ? ' mobile-open' : ''}`}
              initial={false}
            >
              <PortalSidebar
                section={section}
                setSection={setSection}
                collapsed={collapsed}
                onClose={closeMobile}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main content ───────────────────────── */}
        <motion.main
          className="staff-main"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.main>

      </div>
    </SectionContext.Provider>
  )
}
