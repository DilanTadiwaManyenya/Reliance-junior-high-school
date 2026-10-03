import { Link } from 'react-router-dom'
import { FiArrowRight, FiUsers, FiBriefcase } from 'react-icons/fi'
import PortalSiteExitLink from '../../components/portal/PortalSiteExitLink'
import logo from '../../assets/images/reliance-senior-logo.png'
const roles = [
  { name: 'Parent', audience: 'For parents and guardians', to: '/portal/login', description: 'View your learner’s progress, report books and school updates.', icon: <FiUsers /> },
  { name: 'Staff', audience: 'For teachers and school staff', to: '/portal/staff-login', description: 'Manage classes, learner records and your school workspace.', icon: <FiBriefcase /> },
]
export default function PortalEntry() {
  return <section className="portal-auth portal-entry"><div className="portal-auth-card portal-entry-card">
    <PortalSiteExitLink className="portal-website-button">← Back to website</PortalSiteExitLink>
    <div className="portal-entry-heading"><img src={logo} alt="Reliance Learning Centre crest" /><p className="eyebrow">Your school, connected</p><h1>Welcome to Reliance.</h1><p className="muted">Choose your portal to get started.</p></div>
    <div className="portal-role-cards">{roles.map(({ name, audience, to, description, icon }) => <Link className={`portal-role-card ${name.toLowerCase()}`} key={name} to={to}><span className="role-icon" aria-hidden="true">{icon}</span><span className="portal-role-audience">{audience}</span><h2>{name} portal</h2><p>{description}</p><span className="role-action">Sign in to {name.toLowerCase()} portal <FiArrowRight aria-hidden="true" /></span></Link>)}</div>
    <p className="portal-entry-help">Need help accessing your account? <Link to="/contact">Contact the school</Link></p>
  </div></section>
}
