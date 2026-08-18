import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import logo from '../../assets/images/reliance-logo.jpg'
import PortalSiteExitLink from './PortalSiteExitLink'

export default function PortalHeader() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const handleLogout = async () => { await signOut(); navigate('/portal/login') }
  return <header className="portal-header"><div className="container portal-nav"><Link to={profile?.role === 'staff' || profile?.role === 'admin' ? '/portal/staff' : '/portal/dashboard'} className="brand"><img src={logo} alt="Reliance Learning Centre crest"/><span>Reliance Learning Centre<small>Parent Portal · My dashboard</small></span></Link><div className="portal-user"><PortalSiteExitLink className="portal-site-link">← Main website</PortalSiteExitLink><span>{profile?.full_name || 'Portal account'}{profile?.role && <small>{profile.role}</small>}</span><button className="btn secondary" onClick={handleLogout}>Log out</button></div></div></header>
}
