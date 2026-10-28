import { useAuth } from '../../context/useAuth'

export default function PortalAccountContext() {
  const { profile, activeRole } = useAuth()
  const campus = profile?.campus === 'all' ? 'All campuses' : profile?.campus === 'junior' ? 'Junior School' : profile?.campus === 'senior' ? 'Senior School' : null
  return <div className="portal-account-context" role="group" aria-label="Signed-in account">
    <strong>{profile?.full_name || 'Portal account'}</strong>
    <span>{activeRole === 'admin' && profile?.campus === 'all' ? 'Main admin' : activeRole || 'Portal account'}{activeRole !== 'parent' && campus ? ' · ' + campus : ''}</span>
    {activeRole !== 'parent' && campus && <small>{profile?.campus === 'all' ? 'Choose a campus in the workspace when needed.' : 'Access is limited to your assigned campus.'}</small>}
  </div>
}
