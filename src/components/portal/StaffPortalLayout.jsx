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
  setTeacherWorkspace: () => {},
  selectedSubjectAllocationId: '',
  selectedSubjectClassStream: '',
  setSubjectAllocation: () => {},
  selectedSubject: '',
  selectedSubjectLevel: '',
  setSubjectGroup: () => {},
  clearSubjectGroup: () => {}
})
export const useSection = () => useContext(SectionContext)

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
    teacher:    { defaultSection: 'dashboard', allowed: ['dashboard', 'subject-allocations', 'roster', 'entry', 'coursework', 'settings', 'progress-reports'] },
    accountant: { defaultSection: 'fees',      allowed: ['fees', 'expenses', 'inventory'] },
  }[role] ?? { defaultSection: 'dashboard', allowed: ['dashboard'] }
  const section = requestedSection && sectionConfig.allowed.includes(requestedSection)
    ? requestedSection
    : sectionConfig.defaultSection
  const teacherWorkspace = role === 'teacher' && searchParams.get('workspace') === 'subjects' ? 'subjects' : 'classes'
  const selectedSubjectAllocationId = teacherWorkspace === 'subjects' ? searchParams.get('allocation') || '' : ''
  const selectedSubjectClassStream = teacherWorkspace === 'subjects' ? searchParams.get('subjectStream') || '' : ''
  const selectedSubject = teacherWorkspace === 'subjects' ? searchParams.get('subject') || '' : ''
  const selectedSubjectLevel = teacherWorkspace === 'subjects' ? searchParams.get('level') || '' : ''
  const [collapsed, setCollapsed]     = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [activeClassKey, setActiveClassKey] = useState('')
  const [activeClassFilter, setActiveClassFilter] = useState({ level: null, stream: null })

  const toggleCollapse = () => setCollapsed(c => !c)
  const toggleMobile   = () => setMobileOpen(o => !o)
  const closeMobile    = () => setMobileOpen(false)
  const navigateToSection = (nextSection, nextWorkspace = teacherWorkspace, nextAllocationId = selectedSubjectAllocationId, nextSubject = selectedSubject, nextLevel = selectedSubjectLevel, nextSubjectStream = selectedSubjectClassStream) => {
    if (!sectionConfig.allowed.includes(nextSection)) return
    const nextSearch = new URLSearchParams()
    if (nextSection !== sectionConfig.defaultSection) nextSearch.set('section', nextSection)
    if (role === 'teacher' && nextWorkspace === 'subjects') nextSearch.set('workspace', 'subjects')
    if (role === 'teacher' && nextWorkspace === 'subjects' && nextAllocationId) nextSearch.set('allocation', nextAllocationId)
    if (role === 'teacher' && nextWorkspace === 'subjects' && nextSubject) nextSearch.set('subject', nextSubject)
    if (role === 'teacher' && nextWorkspace === 'subjects' && nextLevel) nextSearch.set('level', nextLevel)
    if (role === 'teacher' && nextWorkspace === 'subjects' && nextSubjectStream) nextSearch.set('subjectStream', nextSubjectStream)
    const search = nextSearch.toString() ? `?${nextSearch.toString()}` : ''
    navigate({ pathname: location.pathname, search })
  }
  const changeSection = nextSection => {
    if (role !== 'teacher') return navigateToSection(nextSection)

    const subjectSections = ['subject-allocations', 'entry', 'coursework', 'progress-reports']
    const nextWorkspace = subjectSections.includes(nextSection)
      ? 'subjects'
      : nextSection === 'roster' ? 'classes' : teacherWorkspace
    const preserveSubjectScope = nextWorkspace === 'subjects' && teacherWorkspace === 'subjects'

    navigateToSection(
      nextSection,
      nextWorkspace,
      preserveSubjectScope ? selectedSubjectAllocationId : '',
      preserveSubjectScope ? selectedSubject : '',
      preserveSubjectScope ? selectedSubjectLevel : '',
      preserveSubjectScope ? selectedSubjectClassStream : '',
    )
  }
  const changeTeacherWorkspace = workspace => navigateToSection(workspace === 'subjects' ? 'subject-allocations' : 'roster', workspace, '', '', '')
  const changeSubjectAllocation = (allocationId, classStream = '') => navigateToSection('dashboard', 'subjects', allocationId, selectedSubject, selectedSubjectLevel, classStream)
  const changeSubjectGroup = (subject, level, allocationId = '') => navigateToSection(section, 'subjects', allocationId, subject, level, '')
  const clearSubjectGroup = () => navigateToSection('subject-allocations', 'subjects', '', '', '', '')
  const goBack = () => changeSection(sectionConfig.defaultSection)
  useEffect(() => {
    if (!user || !profile) return
    logActivity(supabase, user, profile, { actionType: 'page_view', description: `Viewed ${section}`, metadata: { path: location.pathname, section } })
  }, [section, location.pathname, profile, supabase, user])

  return (
    <SectionContext.Provider value={{ section, setSection: changeSection, goBack, canGoBack: section !== sectionConfig.defaultSection, activeClassKey, setActiveClassKey, activeClassFilter, setActiveClassFilter, teacherWorkspace, setTeacherWorkspace: changeTeacherWorkspace, selectedSubjectAllocationId, selectedSubjectClassStream, setSubjectAllocation: changeSubjectAllocation, selectedSubject, selectedSubjectLevel, setSubjectGroup: changeSubjectGroup, clearSubjectGroup }}>
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
          <Outlet />
        </motion.main>

      </div>
    </SectionContext.Provider>
  )
}
