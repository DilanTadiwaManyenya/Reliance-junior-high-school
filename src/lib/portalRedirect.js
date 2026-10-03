const roleDestinations = {
  admin: '/portal/staff',
  principal: '/portal/staff',
  staff: '/portal/staff',
  teacher: '/portal/teacher',
  accountant: '/portal/accountant',
  parent: '/portal/dashboard',
}

export const portalDestinationForRole = (role) => roleDestinations[String(role ?? '').trim().toLowerCase()] ?? null

// Login-page choice is presentation only; the profile role decides access.
export const resolvePortalDestination = async (supabase, userId) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, must_update_credentials, portal_access_enabled')
    .eq('id', userId)
    .single()

  if (profile?.portal_access_enabled === false) return { destination: null, error }
  if (profile?.role === 'teacher' && profile?.must_update_credentials) {
    return { destination: '/portal/first-login', error }
  }

  return { destination: portalDestinationForRole(profile?.role), error }
}
