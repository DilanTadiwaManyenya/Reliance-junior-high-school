import { Link } from 'react-router-dom'
import { FiArrowRight, FiBookOpen, FiUsers, FiBriefcase } from 'react-icons/fi'
import PortalSiteExitLink from '../../components/portal/PortalSiteExitLink'
import logo from '../../assets/images/reliance-senior-logo.png'
const roles = [
  { name: 'Parent', to: '/portal/login', description: 'Stay connected to your learner’s progress, records and school updates.', icon: <FiUsers /> },
  { name: 'Student', to: '/portal/student-login', description: 'Find your school records and keep up with the latest updates.', icon: <FiBookOpen /> },
  { name: 'Staff', to: '/portal/staff-login', description: 'Access the tools and information you need for your school day.', icon: <FiBriefcase /> },
]
export default function PortalEntry() {
  return <section className="portal-auth portal-entry"><div className="portal-auth-card portal-entry-card">
    <PortalSiteExitLink className="portal-website-button">← Back to website</PortalSiteExitLink>
    <div className="portal-entry-heading"><img src={logo} alt="Reliance Learning Centre crest" /><p className="eyebrow">Your school, connected</p><h1>Welcome to Reliance.</h1><p className="muted">Choose your portal to get started.</p></div>
    <div className="portal-role-cards">{roles.map(({ name, to, description, icon }) => <Link className="portal-role-card" key={name} to={to}><span className="role-icon" aria-hidden="true">{icon}</span><h2>{name}</h2><p>{description}</p><span className="role-action">Continue as {name.toLowerCase()} <FiArrowRight aria-hidden="true" /></span></Link>)}</div>
    <p className="portal-entry-help">Need help accessing your account? <Link to="/contact">Contact the school</Link></p>
  </div></section>
}
