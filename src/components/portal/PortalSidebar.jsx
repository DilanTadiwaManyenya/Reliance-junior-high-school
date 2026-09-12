import React from 'react'
import { useAuth } from '../../context/useAuth'

const Icon = ({ d, size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{Array.isArray(d) ? d.map((path, index) => <path key={index} d={path} />) : <path d={d} />}</svg>
const icons = { dashboard: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'], roster: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', entry: ['M12 20h9', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'], fees: ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'], staff: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75', 'M9 7m-4 0a4 4 0 1 0 8 0 4 4 0 1 0-8 0'] }
function NavItem({ item, active, onClick, collapsed }) { return <button className={`sidebar-nav-item${active ? ' active' : ''}`} onClick={() => onClick(item.id)} title={collapsed ? item.label : undefined} aria-current={active ? 'page' : undefined}><span className="sidebar-nav-icon"><Icon d={icons[item.iconKey]} /></span>{!collapsed && <span className="sidebar-nav-label">{item.label}</span>}</button> }
export default function PortalSidebar({ section, setSection, collapsed, onClose }) {
  const { profile } = useAuth()
  const manager = ['admin', 'principal'].includes(profile?.role)
  
  const groups = [
    {
      title: 'Workspace',
      items: [
        { id: 'dashboard', label: 'Overview', iconKey: 'dashboard', show: true },
        { id: 'roster', label: 'Learners', iconKey: 'roster', show: true },
        { id: 'entry', label: 'Records', iconKey: 'entry', show: profile?.role === 'admin' || profile?.role === 'teacher' }
      ].filter(i => i.show)
    },
    {
      title: 'Administration',
      items: [
        { id: 'fees', label: 'Finance', iconKey: 'fees', show: manager || profile?.role === 'accountant' },
        { id: 'staff', label: 'Staff', iconKey: 'staff', show: manager }
      ].filter(i => i.show)
    }
  ].filter(g => g.items.length > 0)

  return (
    <aside className={`portal-sidebar sidebar-navigation-only sidebar-navy-gold${collapsed ? ' collapsed' : ''}`} aria-label="Sidebar navigation">
      <nav className="sidebar-nav" aria-label="Main navigation">
        {groups.map((group, index) => (
          <React.Fragment key={index}>
            {!collapsed && <span className="sidebar-nav-heading">{group.title}</span>}
            {group.items.map(item => <NavItem key={item.id} item={item} active={section === item.id} onClick={id => { setSection(id); onClose?.() }} collapsed={collapsed} />)}
          </React.Fragment>
        ))}
      </nav>
    </aside>
  )
}