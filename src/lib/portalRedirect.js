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
    .select('role, must_change_password')
    .eq('id', userId)
    .single()

  if (profile?.must_change_password) {
    return { destination: '/portal/set-password', error }
  }

  return { destination: portalDestinationForRole(profile?.role), error }
}
