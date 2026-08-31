import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

/* ─── SVG Icons ─────────────────────────────────────────────────── */
const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />}
  </svg>
)

const icons = {
  dashboard: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  roster:    'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  entry:     ['M12 20h9', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'],
  fees:      ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  staff:     ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75', 'M9 7m-4 0a4 4 0 1 0 8 0 4 4 0 1 0-8 0'],
}

/* ─── Nav Item ──────────────────────────────────────────────────── */
function NavItem({ id, label, iconKey, active, onClick, collapsed }) {
  return (
    <button
      className={`sidebar-nav-item${active ? ' active' : ''}`}
      onClick={() => onClick(id)}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
    >
      <span className="sidebar-nav-icon">
        <Icon d={icons[iconKey]} />
      </span>
      {!collapsed && <span className="sidebar-nav-label">{label}</span>}
      {active && !collapsed && <span className="sidebar-nav-pip" />}
    </button>
  )
}

/* ─── Sidebar ───────────────────────────────────────────────────── */
export default function PortalSidebar({ section, setSection, collapsed, onClose }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const isManager    = ['admin', 'principal'].includes(profile?.role)
  const isAccountant = profile?.role === 'accountant'
  const isTeacher    = profile?.role === 'teacher'

  const handleNav = (id) => {
    setSection(id)
    if (onClose) onClose()
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/portal/login')
  }

  const initials = (profile?.full_name || 'U')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const navItems = [
    { id: 'dashboard', label: 'Dashboard',  iconKey: 'dashboard', show: true },
    { id: 'roster',    label: 'Roster',     iconKey: 'roster',    show: true },
    { id: 'entry',     label: 'Data Entry', iconKey: 'entry',     show: !isAccountant },
    { id: 'fees',      label: 'Fees',       iconKey: 'fees',      show: isManager || isAccountant },
    { id: 'staff',     label: 'Staff',      iconKey: 'staff',     show: isManager },
  ].filter(item => item.show)

  return (
    <aside className={`portal-sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Sidebar navigation">
      {/* ── Brand ── */}
      <div className="sidebar-brand">
        <div className="sidebar-crest">
          <svg viewBox="0 0 100 115" width="36" height="36">
            <path fill="#1B2A56" d="M50 3 88 17v39c0 28-20 46-38 54C32 102 12 84 12 56V17z"/>
            <path fill="#A6302F" d="M50 9 82 21v34c0 24-16 40-32 48-16-8-32-24-32-48V21z"/>
            <path fill="#E3B23C" d="M24 35h52v6H24zm4 34h44v6H28z"/>
            <path fill="#fff"    d="M31 47h38v17H31z"/>
            <path fill="#1B2A56" d="M35 50h13v11H35zm17 0h13v11H52z"/>
            <path fill="#3FA9DA" d="M10 82h80v12H10z"/>
            <text x="50" y="90" fill="white" fontSize="7" textAnchor="middle" fontFamily="sans-serif">RELIANCE</text>
          </svg>
        </div>
        {!collapsed && (
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">Reliance</span>
            <span className="sidebar-brand-sub">Learning Centre</span>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navItems.map(item => (
          <NavItem
            key={item.id}
            id={item.id}
            label={item.label}
            iconKey={item.iconKey}
            active={section === item.id}
            onClick={handleNav}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* ── Divider ── */}
      <div className="sidebar-divider" />

      {/* ── User profile ── */}
      <div className="sidebar-user">
        <div className="sidebar-avatar" aria-hidden="true">{initials}</div>
        {!collapsed && (
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{profile?.full_name || 'Portal User'}</span>
            <span className="sidebar-user-role">{profile?.role || 'user'}</span>
          </div>
        )}
      </div>
    </aside>
  )
}
