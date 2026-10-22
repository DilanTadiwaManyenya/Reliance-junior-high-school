import RoleSwitcher from './RoleSwitcher'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import ClassSelector, { parseClassKey } from './ClassSelector'
import { useSection } from './StaffPortalLayout'
import PortalSiteExitLink from './PortalSiteExitLink'
import { useSchoolClasses } from '../../hooks/useSchoolClasses'
import CampusBrandMark from '../branding/CampusBrandMark'

/* ── Hamburger / collapse icon ───────────────────────────────────── */
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6"  />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

export default function StaffTopBar({ onToggleSidebar, onToggleMobile, mobileOpen = false }) {
  const { profile, user, activeRole, signOut, supabase } = useAuth()
  const navigate = useNavigate()
  const { activeClassKey, setActiveClassKey, setActiveClassFilter, activeAdminCampusScope, setAdminCampusScope, goBack, canGoBack, section, setSection, teacherWorkspace, setTeacherWorkspace, selectedSubjectAllocationId, selectedSubject, selectedSubjectLevel, clearSubjectGroup } = useSection()
  const { classes: schoolClasses } = useSchoolClasses(supabase)

  const handleLogout = async () => {
    navigate('/portal', { replace: true })
    sessionStorage.removeItem('reliance-active-role')
    try {
      await signOut()
    } catch (error) {
      console.error('Portal sign-out failed:', error)
    }
  }

  const handleClassChange = (key, option) => {
    setActiveClassKey(key)
    if (key === 'ALL' || !key) {
      setActiveClassFilter({ level: null, stream: null })
    } else if (option?.level) {
      setActiveClassFilter({ level: option.level, stream: option.stream || null })
    } else {
      setActiveClassFilter(parseClassKey(key))
    }
  }

  const isMainAdmin = activeRole === 'admin' && profile?.campus === 'all'
  const isJuniorTeacher = activeRole === 'teacher' && profile?.campus === 'junior'
  const adminCampusScope = activeRole === 'admin' && ['junior', 'senior'].includes(profile?.campus)
    ? profile.campus
    : null;
  const campusScope = ['junior', 'senior'].includes(profile?.campus) ? profile.campus : 'all'
  const visibleSchoolClasses = campusScope !== 'all'
    ? schoolClasses.filter((row) => row.campus === campusScope)
    : schoolClasses
  const roleLabel = isMainAdmin ? 'Main Admin Portal' : adminCampusScope === 'junior' ? 'Junior Admin Portal' : adminCampusScope === 'senior' ? 'Senior Admin Portal' : {
    principal: 'Principal Portal',
    admin:     'Admin Portal',
    teacher:   'Teacher Portal',
    accountant:'Accountant Portal',
  }[activeRole] ?? 'Staff Portal'

  const initials = (profile?.full_name || 'Portal User').split(' ').map(name => name[0]).join('').slice(0, 2).toUpperCase()
  const hasTeacherSubjectScope = activeRole === 'teacher' && teacherWorkspace === 'subjects' && Boolean(selectedSubjectAllocationId)
  // Class Work belongs to class teachers; subject allocations stay in Subject Work.
  const teacherClassOptions = profile?.teacher_class_assignments || []
  const showClassControl = activeRole === 'accountant' ? false : activeRole === 'teacher'
    ? teacherWorkspace !== 'subjects'
    : ['dashboard', 'roster', 'entry', 'progress-reports', 'classes'].includes(section)

  return (
    <header className="staff-top-bar" role="banner">
      {/* ── Left: toggle + brand ───────────── */}
      <div className="top-bar-left">
        {/* Desktop collapse toggle */}
        {activeRole !== 'accountant' && (
          <button
            className="top-bar-toggle desktop-toggle"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
            title="Collapse sidebar"
          >
            <MenuIcon />
          </button>
        )}
        {/* Mobile hamburger */}
        {activeRole !== 'accountant' && (
          <button
            className="top-bar-toggle mobile-toggle"
            onClick={onToggleMobile}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="staff-portal-navigation"
          >
            <MenuIcon />
          </button>
        )}

        <div className="top-bar-brand">
          <CampusBrandMark campus={profile?.campus} className="top-bar-campus-brand" />
          <div className="top-bar-brand-text">
            <span className="top-bar-name">Reliance Learning Centre</span>
            <span className="top-bar-sub">{roleLabel}</span>
          </div>
        </div>
      </div>

      <span className="staff-mobile-title"><CampusBrandMark campus={profile?.campus} className="staff-mobile-campus-brand" />{roleLabel}</span>
      {/* ── Right: user info + logout ──────── */}
        <div className="top-bar-user">
          {activeRole === 'teacher' && profile?.campus !== 'junior' && (
            <div className="teacher-workspace-switch" aria-label="Teacher workspace">
              <button type="button" aria-pressed={teacherWorkspace === 'classes'} className={teacherWorkspace === 'classes' ? 'active' : ''} onClick={() => setTeacherWorkspace('classes')}>Class work</button>
              <button type="button" aria-pressed={teacherWorkspace === 'subjects'} className={teacherWorkspace === 'subjects' ? 'active' : ''} onClick={() => setTeacherWorkspace('subjects')}>Subject work</button>
            </div>
          )}
          {hasTeacherSubjectScope && <div className="teacher-subject-scope" aria-label="Active subject allocation"><span>Subject work</span><strong>{selectedSubject} · {selectedSubjectLevel}</strong></div>}
          {showClassControl && <div className="top-bar-class-control" style={{ marginRight: '20px' }}>
            <ClassSelector 
              storageScope={user?.id || 'signed-out'}
              role={activeRole}
              assignedClasses={teacherClassOptions}
              allClasses={visibleSchoolClasses.map((row) => ({ class_level: row.class_level, class_stream: row.class_stream || '', campus: row.campus || '' }))}
              activeClassKey={activeClassKey} 
              onClassChange={handleClassChange} 
              campusScope={campusScope}
              campusFilter={isMainAdmin ? activeAdminCampusScope : undefined}
              onCampusChange={isMainAdmin ? setAdminCampusScope : undefined}
            />
          </div>}
          {activeRole === 'teacher' ? (
            isJuniorTeacher ? (
              section !== 'dashboard' && <button className="top-bar-back" onClick={() => setSection('dashboard')} title="Return to your class workspace">← My class</button>
            ) : (
            hasTeacherSubjectScope ? <button className="top-bar-back" onClick={clearSubjectGroup} title="Choose another subject and form">← Subject allocations</button>
              : !['dashboard', 'subject-allocations'].includes(section) && <button className="top-bar-back" onClick={() => setSection('subject-allocations')} title="Return to subject allocations">← Subject allocations</button>
            )
          ) : (
            <button className="top-bar-back" onClick={goBack} disabled={!canGoBack} title={canGoBack ? 'Return to the previous portal page' : 'You are already at the portal home'}>← Back</button>
          )}
          <RoleSwitcher />
          <PortalSiteExitLink className="top-bar-site-link">← Website</PortalSiteExitLink>
          <div className="top-bar-avatar" aria-hidden="true">{initials}</div>
        <div className="top-bar-user-info">
          <span className="top-bar-username">{profile?.full_name || 'Portal User'}</span>
          <span className="top-bar-role-badge">{isMainAdmin ? 'Main Admin' : activeRole || 'staff'}</span>
        </div>
        <button className="top-bar-logout" onClick={handleLogout} title="Log out" aria-label="Log out">
          <LogoutIcon />
          <span>Log out</span>
        </button>
      </div>
    </header>
  )
}
