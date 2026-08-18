import { Link } from 'react-router-dom'
import PortalNotice from '../../components/portal/PortalNotice'
import PortalSiteExitLink from '../../components/portal/PortalSiteExitLink'
import logo from '../../assets/images/reliance-logo.jpg'

export default function ForgotPassword() {
  return <main className="portal-auth"><section className="portal-auth-card portal-auth-animated"><PortalSiteExitLink className="portal-back">← Back to Reliance Learning Centre website</PortalSiteExitLink><img className="portal-auth-crest" src={logo} alt="Reliance Learning Centre crest" /><p className="eyebrow">Password help</p><h1>Reset your password</h1><p className="muted">For your security, password resets are handled by the school office.</p><PortalNotice>To reset your portal password, please contact the school office at <a href="tel:+263716663966">+263 71 666 3966</a> or visit in person with your child’s admission details, and staff can reset it for you.</PortalNotice><p><Link to="/portal/login">Back to sign in</Link></p></section></main>
}
