import { Link } from 'react-router-dom'

// This is only for links that leave the portal for the public website.
export default function PortalSiteExitLink({ className, children }) {
  return <Link className={className} to="/">{children}</Link>
}
