import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

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

export default function StaffTopBar({ onToggleSidebar, onToggleMobile }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/portal/login')
  }

  const roleLabel = {
    principal: 'Principal Portal',
    admin:     'Admin Portal',
    teacher:   'Teacher Portal',
    accountant:'Accountant Portal',
  }[profile?.role] ?? 'Staff Portal'

  return (
    <header className="staff-top-bar" role="banner">
      {/* ── Left: toggle + brand ───────────── */}
      <div className="top-bar-left">
        {/* Desktop collapse toggle */}
        <button
          className="top-bar-toggle desktop-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          title="Collapse sidebar"
        >
          <MenuIcon />
        </button>
        {/* Mobile hamburger */}
        <button
          className="top-bar-toggle mobile-toggle"
          onClick={onToggleMobile}
          aria-label="Open navigation menu"
        >
          <MenuIcon />
        </button>

        <div className="top-bar-brand">
          <svg viewBox="0 0 100 115" className="top-bar-crest" aria-hidden="true">
            <path fill="#1B2A56" d="M50 3 88 17v39c0 28-20 46-38 54C32 102 12 84 12 56V17z"/>
            <path fill="#A6302F" d="M50 9 82 21v34c0 24-16 40-32 48-16-8-32-24-32-48V21z"/>
            <path fill="#E3B23C" d="M24 35h52v6H24zm4 34h44v6H28z"/>
            <path fill="#fff"    d="M31 47h38v17H31z"/>
            <path fill="#1B2A56" d="M35 50h13v11H35zm17 0h13v11H52z"/>
            <path fill="#3FA9DA" d="M10 82h80v12H10z"/>
            <text x="50" y="90" fill="white" fontSize="7" textAnchor="middle" fontFamily="sans-serif">RELIANCE</text>
          </svg>
          <div className="top-bar-brand-text">
            <span className="top-bar-name">Reliance Learning Centre</span>
            <span className="top-bar-sub">{roleLabel}</span>
          </div>
        </div>
      </div>

      {/* ── Right: user info + logout ──────── */}
      <div className="top-bar-user">
        <div className="top-bar-user-info">
          <span className="top-bar-username">{profile?.full_name || 'Portal User'}</span>
          <span className="top-bar-role-badge">{profile?.role || 'staff'}</span>
        </div>
        <button className="top-bar-logout" onClick={handleLogout} title="Log out">
          <LogoutIcon />
          <span>Log out</span>
        </button>
      </div>
    </header>
  )
}
