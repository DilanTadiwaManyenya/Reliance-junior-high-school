import { Link } from 'react-router-dom'
import PortalSiteExitLink from '../../components/portal/PortalSiteExitLink'
import Card from '../../components/ui/Card'

const roles = [
  { name: 'Parent', to: '/portal/login', description: 'View your learner’s records and school updates.', color: '#A6302F' },
  { name: 'Student', to: '/portal/student-login', description: 'View your own school records and updates.', color: '#1B2A56' },
  { name: 'Staff', to: '/portal/staff-login', description: 'Sign in with your school staff account.', color: '#E3B23C' },
]

export default function PortalEntry() {
  return <main className="portal-auth"><section className="portal-auth-card" style={{ width: 'min(100%, 860px)' }}><PortalSiteExitLink className="portal-back">← Back to Reliance Learning Centre website</PortalSiteExitLink><p className="eyebrow">Reliance Portal</p><h1>Are you a Parent, Student, or Staff?</h1><div className="portal-role-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 18, marginTop: 28 }}>{roles.map(role => <Link key={role.name} to={role.to} aria-label={`${role.name}: ${role.description}`}><Card className="portal-role-card" style={{ borderTopColor: role.color, minHeight: 180, padding: 26 }}><strong style={{ display: 'block', fontFamily: 'Fraunces, serif', fontSize: '1.5rem', color: '#1B2A56', marginBottom: 10 }}>{role.name}</strong><span style={{ display: 'block', color: '#665f5a', lineHeight: 1.6, fontWeight: 400 }}>{role.description}</span></Card></Link>)}</div></section></main>
}
