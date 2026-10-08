import { createContext, useContext, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import PortalSidebar from './PortalSidebar'
import StaffTopBar from './StaffTopBar'
import { useAuth } from '../../context/useAuth'
import { logActivity } from '../../lib/logActivity'

/* ── Section context shared with child pages ─────────────────────── */
export const SectionContext = createContext({ 
  section: 'dashboard', 
  setSection: () => {},
  goBack: () => {},
  canGoBack: false,
  activeClassKey: '',
  setActiveClassKey: () => {},
  activeClassFilter: { level: null, stream: null },
  setActiveClassFilter: () => {},
  teacherWorkspace: 'classes',
  setTeacherWorkspace: () => {}
})
export const useSection = () => useContext(SectionContext)

function SubjectAllocationBanner({ profile }) {
  const assignments = profile?.teacher_class_subject_assignments || []
  const teacherName = profile?.full_name || 'Assigned teacher'
  return <section className="teacher-subject-context" aria-label="Subject class teacher allocations"><div className="teacher-subject-context-heading"><span>Subject workspace</span><strong>Assigned subject classes</strong></div>{assignments.length ? <div className="teacher-subject-context-list">{assignments.map((assignment, index) => <span key={assignment.id || `${assignment.subject}-${assignment.class_level}-${assignment.class_stream || ''}-${index}`}><b>{assignment.subject}</b> · {assignment.class_level}{assignment.class_stream ? ` ${assignment.class_stream}` : ''} · Teacher: {teacherName}</span>)}</div> : <p>No subject classes have been assigned yet.</p>}</section>
}

export default function StaffPortalLayout() {
  const { profile, user, supabase } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const role = profile?.active_role ?? profile?.role
  const searchParams = new URLSearchParams(location.search)
  const requestedSection = searchParams.get('section')
  const sectionConfig = {
    admin:      { defaultSection: 'dashboard', allowed: ['dashboard', 'roster', 'entry', 'settings', 'bulk-import', 'report-settings', 'grade-bands', 'progress-reports', 'fees', 'expenses', 'inventory', 'staff', 'classes', 'activity'] },
    principal:  { defaultSection: 'dashboard', allowed: ['dashboard', 'roster', 'settings', 'fees', 'expenses', 'staff', 'activity'] },
    teacher:    { defaultSection: 'dashboard', allowed: ['dashboard', 'roster', 'entry', 'coursework', 'settings', 'progress-reports'] },
    accountant: { defaultSection: 'fees',      allowed: ['fees', 'expenses', 'inventory'] },
  }[role] ?? { defaultSection: 'dashboard', allowed: ['dashboard'] }
  const section = requestedSection && sectionConfig.allowed.includes(requestedSection)
    ? requestedSection
    : sectionConfig.defaultSection
  const teacherWorkspace = role === 'teacher' && searchParams.get('workspace') === 'subjects' ? 'subjects' : 'classes'
  const [collapsed, setCollapsed]     = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [activeClassKey, setActiveClassKey] = useState('')
  const [activeClassFilter, setActiveClassFilter] = useState({ level: null, stream: null })

  const toggleCollapse = () => setCollapsed(c => !c)
  const toggleMobile   = () => setMobileOpen(o => !o)
  const closeMobile    = () => setMobileOpen(false)
  const navigateToSection = (nextSection, nextWorkspace = teacherWorkspace) => {
    if (!sectionConfig.allowed.includes(nextSection)) return
    const nextSearch = new URLSearchParams()
    if (nextSection !== sectionConfig.defaultSection) nextSearch.set('section', nextSection)
    if (role === 'teacher' && nextWorkspace === 'subjects') nextSearch.set('workspace', 'subjects')
    const search = nextSearch.toString() ? `?${nextSearch.toString()}` : ''
    navigate({ pathname: location.pathname, search })
  }
  const changeSection = nextSection => navigateToSection(nextSection)
  const changeTeacherWorkspace = workspace => navigateToSection(workspace === 'subjects' ? 'coursework' : 'roster', workspace)
  const goBack = () => changeSection(sectionConfig.defaultSection)
  useEffect(() => {
    if (!user || !profile) return
    logActivity(supabase, user, profile, { actionType: 'page_view', description: `Viewed ${section}`, metadata: { path: location.pathname, section } })
  }, [section, location.pathname, profile, supabase, user])

  return (
    <SectionContext.Provider value={{ section, setSection: changeSection, goBack, canGoBack: section !== sectionConfig.defaultSection, activeClassKey, setActiveClassKey, activeClassFilter, setActiveClassFilter, teacherWorkspace, setTeacherWorkspace: changeTeacherWorkspace }}>
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
                setSection={changeSection}
                teacherWorkspace={teacherWorkspace}
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
          {role === 'teacher' && teacherWorkspace === 'subjects' && <SubjectAllocationBanner profile={profile} />}
          <Outlet />
        </motion.main>

      </div>
    </SectionContext.Provider>
  )
}
