const roleDestinations = {
  admin: '/portal/staff',
  principal: '/portal/staff',
  staff: '/portal/staff',
  teacher: '/portal/teacher',
  accountant: '/portal/accountant',
  parent: '/portal/dashboard',
}

export const portalDestinationForRole = (role) => roleDestinations[String(role ?? '').trim().toLowerCase()] ?? null
export const isStaffPortalRole = role => ['admin', 'principal', 'staff', 'teacher', 'accountant'].includes(String(role ?? '').trim().toLowerCase())

// Prefer the profile already loaded by AuthProvider.  The database fallback
// retains compatibility with deployments that have not yet applied the
// temporary-password migration.
export const resolvePortalDestination = async (supabase, userId, loadedProfile = null) => {
  let profile = loadedProfile
  let error = null
  if (!profile) {
    const result = await supabase.from('profiles').select('role, active_role, must_change_password').eq('id', userId).single()
    profile = result.data
    error = result.error
    if (error && /must_change_password/i.test(error.message || '')) {
      const legacy = await supabase.from('profiles').select('role, active_role').eq('id', userId).single()
      profile = legacy.data
      error = legacy.error
    }
  }

  if (profile?.must_change_password) {
    return { destination: '/portal/set-password', error, profile }
  }

  return { destination: portalDestinationForRole(profile?.active_role || profile?.role), error, profile }
}
