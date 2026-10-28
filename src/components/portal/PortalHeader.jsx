import AnnouncementBell from './AnnouncementBell'
import PortalAccountContext from './PortalAccountContext'
import { useContext } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { portalDestinationForRole } from '../../lib/portalRedirect'
import { useAuth } from '../../context/useAuth'
import PortalSiteExitLink from './PortalSiteExitLink'
import CampusBrandMark from '../branding/CampusBrandMark'
import { PortalBrandCampusContext } from './PortalBrandCampusContext'
import './parentLearningLibrary.css'

export default function PortalHeader() {
  const { profile, activeRole, signOut } = useAuth()
  const campus = useContext(PortalBrandCampusContext)
  const navigate = useNavigate()
  const location = useLocation()
  const handleLogout = async () => {
    navigate('/portal', { replace: true })
    sessionStorage.removeItem('reliance-active-role')
    try {
      await signOut()
    } catch (error) {
      console.error('Portal sign-out failed:', error)
    }
  }
  const learner = new URLSearchParams(location.search).get('learner') || location.pathname.match(/^\/portal\/learner\/([^/]+)/)?.[1]
  const learnerSearch = learner ? `?learner=${encodeURIComponent(learner)}` : ''
  const goBack = () => learner && location.pathname !== '/portal/dashboard' ? navigate(`/portal/dashboard?learner=${encodeURIComponent(learner)}`) : window.history.length > 1 ? navigate(-1) : navigate('/portal/dashboard')
  return <header className="portal-header"><div className="container portal-nav"><Link to={portalDestinationForRole(activeRole) || '/portal/dashboard'} className="brand"><CampusBrandMark campus={campus} /><span>Reliance Learning Centre<small>Portal · My dashboard</small></span></Link><div className="portal-user"><button className="btn secondary portal-history-back" onClick={goBack}>← Back</button><PortalSiteExitLink className="portal-website-button portal-site-link">← Website</PortalSiteExitLink><span>{profile?.full_name || 'Portal account'}{activeRole && <small>{activeRole}</small>}</span><button className="btn secondary portal-logout-btn" onClick={handleLogout}>Log out</button></div></div>{activeRole === 'parent' && <nav className="parent-learning-nav container" aria-label="Parent learning navigation"><Link to={`/portal/dashboard${learnerSearch}`} aria-current={location.pathname === '/portal/dashboard' ? 'page' : undefined}>Dashboard</Link><Link to={`/portal/library${learnerSearch}`} aria-current={location.pathname === '/portal/library' ? 'page' : undefined}>Learning library</Link><AnnouncementBell learnerId={learner} /></nav>}<PortalAccountContext /></header>
}
