import { Link, useLocation } from 'react-router-dom'
import { FiBell } from 'react-icons/fi'

// Use the selected-learner feed. Opening the bell never acknowledges a notice.
export default function AnnouncementBell({ learnerId }) {
  const location = useLocation()
  const search = learnerId ? `?learner=${encodeURIComponent(learnerId)}` : ''
  return <Link to={`/portal/announcements${search}`} aria-current={location.pathname === '/portal/announcements' ? 'page' : undefined}><FiBell aria-hidden="true" /><span>Newsletters</span></Link>
}
