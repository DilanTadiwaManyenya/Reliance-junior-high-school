import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

// This is only for links that leave the portal for the public website.
export default function PortalSiteExitLink({ className, children }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const exitPortal = async (event) => {
    event.preventDefault()
    try {
      const result = await signOut()
      // Temporary diagnostic: confirm this specific public-site exit signed out.
      console.log('[PortalSiteExitLink] Supabase sign-out result:', { error: result?.error ?? null, result })
      navigate('/')
    } catch (error) {
      console.error('[PortalSiteExitLink] Supabase sign-out failed:', error)
    }
  }

  return <Link className={className} to="/" onClick={exitPortal}>{children}</Link>
}
