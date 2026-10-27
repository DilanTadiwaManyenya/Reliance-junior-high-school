const roleDestinations = {
  admin: '/portal/staff',
  principal: '/portal/staff',
  teacher: '/portal/teacher',
  accountant: '/portal/accountant',
  parent: '/portal/dashboard',
}

export const portalDestinationForRole = (role) => roleDestinations[String(role ?? '').trim().toLowerCase()] ?? null
export const isStaffPortalRole = role => ['admin', 'principal', 'teacher', 'accountant'].includes(String(role ?? '').trim().toLowerCase())

// Prefer the profile already loaded by AuthProvider.  The database fallback
// retains compatibility with deployments that have not yet applied the
// temporary-password migration.
export const resolvePortalDestination = async (supabase, userId, loadedProfile = null, requestedPortal = 'any') => {
  let profile = loadedProfile
  let error = null
  if (!profile) {
    let result = await supabase.from('profiles').select('role, active_role, must_change_password, user_roles(role)').eq('id', userId).single()
    if (result.error && /must_change_password/i.test(result.error.message || '')) {
      result = await supabase.from('profiles').select('role, active_role, user_roles(role)').eq('id', userId).single()
    }
    if (result.error && /(could not find.*relationship|relationship.*schema cache|relation .*user_roles.*does not exist)/i.test(result.error.message || '')) {
      result = await supabase.from('profiles').select('role, active_role').eq('id', userId).single()
    }
    profile = result.data
    error = result.error
  }

  const activeRole = String(profile?.active_role || profile?.role || '').trim().toLowerCase()
  const assignedRoles = Array.isArray(profile?.user_roles) ? profile.user_roles.map(({ role }) => String(role || '').trim().toLowerCase()) : null
  const assignedActiveRole = !assignedRoles || assignedRoles.includes(activeRole)
  const portalRoleMatches = requestedPortal === 'any'
    || (requestedPortal === 'parent' && activeRole === 'parent')
    || (requestedPortal === 'staff' && isStaffPortalRole(activeRole))
  if (profile && (!assignedActiveRole || !portalRoleMatches)) {
    return { destination: null, error, profile, portalMismatch: true }
  }

  if (profile?.must_change_password) {
    return { destination: '/portal/set-password', error, profile, portalMismatch: false }
  }

  return { destination: portalDestinationForRole(activeRole), error, profile, portalMismatch: false }
}
