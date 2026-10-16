import PortalAccountContext from './PortalAccountContext'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { portalDestinationForRole } from '../../lib/portalRedirect'
import { useAuth } from '../../context/useAuth'
import logo from '../../assets/images/reliance-senior-logo.png'
import PortalSiteExitLink from './PortalSiteExitLink'

export default function PortalHeader() {
  const { profile, activeRole, signOut } = useAuth()
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
  const goBack = () => learner && location.pathname !== '/portal/dashboard' ? navigate(`/portal/dashboard?learner=${encodeURIComponent(learner)}`) : window.history.length > 1 ? navigate(-1) : navigate('/portal/dashboard')
  return <header className="portal-header"><div className="container portal-nav"><Link to={portalDestinationForRole(activeRole) || '/portal/dashboard'} className="brand"><img src={logo} alt="Reliance Learning Centre crest"/><span>Reliance Learning Centre<small>Portal · My dashboard</small></span></Link><div className="portal-user"><button className="btn secondary portal-history-back" onClick={goBack}>← Back</button><PortalSiteExitLink className="portal-website-button portal-site-link">← Website</PortalSiteExitLink><span>{profile?.full_name || 'Portal account'}{activeRole && <small>{activeRole}</small>}</span><button className="btn secondary" onClick={handleLogout}>Log out</button></div></div><PortalAccountContext /></header>
}
