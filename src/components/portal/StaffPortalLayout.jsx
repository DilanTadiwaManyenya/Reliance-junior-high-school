import PortalAccountContext from './PortalAccountContext'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import PortalSidebar from './PortalSidebar'
import AccountantWorkspaceNav from './AccountantWorkspaceNav'
import StaffTopBar from './StaffTopBar'
import { useAuth } from '../../context/useAuth'
import { useModalFocus } from '../../hooks/useModalFocus'
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

// Class workspaces are nested pages encoded in the URL. A generic “go home”
// back button loses that hierarchy and sent admins to Overview. Always walk
// the class hierarchy first, even when the page was opened in a new tab.
const classParentSearch = (search) => {
  const params = new URLSearchParams(search)
  if (params.get('section') !== 'classes') return null

  if (params.has('view')) {
    params.delete('view')
  } else if (params.has('stream')) {
    params.delete('stream')
  } else if (params.has('classLevel') || params.has('campus')) {
    params.delete('classLevel')
    params.delete('campus')
  } else {
    return null
  }

  const value = params.toString()
  return value ? `?${value}` : ''
}

export default function StaffPortalLayout() {
  const { activeRole } = useAuth()
  return <StaffPortalWorkspace key={activeRole} />
}

function StaffPortalWorkspace() {
  const { profile, user, supabase, roles } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const role = profile?.active_role ?? profile?.role
  const searchParams = new URLSearchParams(location.search)
  const requestedSection = searchParams.get('section')
  const sectionConfig = {
    admin:      { defaultSection: 'dashboard', allowed: ['dashboard', 'roster', 'entry', 'settings', 'bulk-import', 'report-settings', 'grade-bands', 'progress-reports', 'fees', 'expenses', 'inventory', 'staff', 'classes', 'year-planning', 'year-rollover', 'reporting-periods', 'historical-reports', 'activity'] },
    principal:  { defaultSection: 'dashboard', allowed: ['dashboard', 'roster', 'settings', 'fees', 'expenses', 'staff', 'historical-reports', 'activity'] },
    teacher:    { defaultSection: 'dashboard', allowed: ['dashboard', 'subject-allocations', 'roster', 'entry', 'coursework', 'library', 'settings'] },
    accountant: { defaultSection: 'fees',      allowed: ['fees', 'learner-profiles', 'expenses', 'inventory', 'progress-reports', 'historical-reports'] },
  }[role] ?? { defaultSection: 'dashboard', allowed: ['dashboard'] }
  const isJuniorTeacher = role === 'teacher' && profile?.campus === 'junior'
  const invalidRequestedSection = Boolean(requestedSection && (!sectionConfig.allowed.includes(requestedSection) || (isJuniorTeacher && requestedSection === 'subject-allocations')))
  const section = requestedSection && !invalidRequestedSection
    ? requestedSection
    : sectionConfig.defaultSection
  useEffect(() => {
    if (!invalidRequestedSection) return
    const nextSearch = new URLSearchParams(location.search)
    nextSearch.delete('section')
    navigate({ pathname: location.pathname, search: nextSearch.toString() ? `?${nextSearch.toString()}` : '' }, { replace: true })
  }, [invalidRequestedSection, location.pathname, location.search, navigate])
  // Junior class teachers work with the complete curriculum for their class.
  // They must never be routed into the Senior subject-allocation workspace.
  const teacherWorkspace = role === 'teacher' && !isJuniorTeacher && searchParams.get('workspace') === 'subjects' ? 'subjects' : 'classes'
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
  const closeMobile = () => setMobileOpen(false)
  const drawerRef = useRef(null)
  useModalFocus(mobileOpen, drawerRef, closeMobile)
  const hasClassControl = role === 'teacher' ? teacherWorkspace !== 'subjects' : role !== 'accountant' && ['dashboard', 'roster', 'entry', 'progress-reports', 'classes'].includes(section)
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

    const subjectSections = ['subject-allocations', 'entry', 'coursework', 'library']
    const nextWorkspace = !isJuniorTeacher && subjectSections.includes(nextSection)
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
  const changeTeacherWorkspace = workspace => {
    if (isJuniorTeacher) return navigateToSection('roster', 'classes', '', '', '')
    return navigateToSection(workspace === 'subjects' ? 'subject-allocations' : 'roster', workspace, '', '', '')
  }
  const changeSubjectAllocation = (allocationId, classStream = '') => navigateToSection('dashboard', 'subjects', allocationId, selectedSubject, selectedSubjectLevel, classStream)
  const changeSubjectGroup = (subject, level, allocationId = '', nextSection = section) => navigateToSection(nextSection, 'subjects', allocationId, subject, level, '')
  const clearSubjectGroup = () => navigateToSection('subject-allocations', 'subjects', '', '', '', '')
  const goBack = () => {
    const classParent = classParentSearch(location.search)
    if (classParent !== null) {
      navigate({ pathname: location.pathname, search: classParent })
      return
    }
    changeSection(sectionConfig.defaultSection)
  }
  useEffect(() => {
    if (!user || !profile) return
    logActivity(supabase, user, profile, { actionType: 'page_view', description: `Viewed ${section}`, metadata: { path: location.pathname, section } })
  }, [section, location.pathname, profile, supabase, user])

  return (
    <SectionContext.Provider value={{ section, setSection: changeSection, goBack, canGoBack: section !== sectionConfig.defaultSection, activeClassKey, setActiveClassKey, activeClassFilter, setActiveClassFilter, teacherWorkspace, isJuniorTeacher, setTeacherWorkspace: changeTeacherWorkspace, selectedSubjectAllocationId, selectedSubjectClassStream, setSubjectAllocation: changeSubjectAllocation, selectedSubject, selectedSubjectLevel, setSubjectGroup: changeSubjectGroup, clearSubjectGroup }}>
      <div data-campus={['junior', 'senior'].includes(profile?.campus) ? profile.campus : 'all'} data-class-control={hasClassControl} data-role={role} data-workspace={teacherWorkspace} data-section={section} data-multiple-roles={roles.length > 1} className={`staff-shell${collapsed ? ' sidebar-collapsed' : ''}${role === 'accountant' ? ' no-sidebar' : ''}${profile?.campus === 'junior' ? ' campus-junior' : profile?.campus === 'senior' ? ' campus-senior' : ''}`}>

        {/* ── Top header bar ─────────────────────── */}
        <StaffTopBar
          onToggleSidebar={toggleCollapse}
          onToggleMobile={toggleMobile}
          mobileOpen={mobileOpen}
        />

        {/* ── Mobile overlay backdrop ─────────────── */}
        <AnimatePresence>
          {mobileOpen && role !== 'accountant' && (
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
          {role !== 'accountant' && (
            <motion.div
              ref={drawerRef}
              id="staff-portal-navigation"
              role={mobileOpen ? 'dialog' : undefined}
              aria-modal={mobileOpen || undefined}
              aria-label={mobileOpen ? 'Portal navigation' : undefined}
              tabIndex={-1}
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
        <main className="staff-main">
          <PortalAccountContext />
          {role === 'teacher' && !['dashboard', 'subject-allocations', 'coursework', 'library'].includes(section) && <div className="teacher-workspace-return"><button type="button" className="btn secondary" onClick={() => isJuniorTeacher || teacherWorkspace === 'classes' ? changeSection('dashboard') : clearSubjectGroup()}>{isJuniorTeacher ? '← My class' : teacherWorkspace === 'subjects' ? '← Subject allocations' : '← Class work'}</button></div>}
          {role !== 'teacher' && section !== sectionConfig.defaultSection && <div className="staff-workspace-return"><button type="button" className="btn secondary" onClick={goBack}>← Back</button></div>}
          {role === 'accountant' && <AccountantWorkspaceNav section={section} onChange={changeSection} />}
          <Outlet />
        </main>

      </div>
    </SectionContext.Provider>
  )
}
