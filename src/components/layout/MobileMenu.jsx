import { NavLink, Link } from 'react-router-dom'
import { navigation } from '../../data/navigation'
export default function MobileMenu({ open, close }) {
  if (!open) return null
  return <nav id="mobile-navigation" className="mobile-menu" aria-label="Mobile navigation">
    <div className="mobile-links">{navigation.map(([name, path]) => <NavLink onClick={close} key={path} to={path} end={path === '/'}>{name}</NavLink>)}</div>
    <div className="mobile-actions"><Link className="btn secondary" to="/portal" onClick={close}>Sign in to portal</Link><Link className="btn primary" to="/admissions" onClick={close}>Apply now</Link></div>
  </nav>
}
