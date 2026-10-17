/** Verify signed caller claims before a service-role operation bypasses RLS. */
export async function requireAdminMfa(client, token) {
  const settings = await client.from('portal_security_settings').select('require_admin_mfa').eq('id', 1).single()
  if (settings.error || !settings.data) throw new Error('Unable to verify admin security requirements. Please try again.')
  if (!settings.data.require_admin_mfa) return
  if (!token) throw new Error('Authentication is required.')
  const result = await client.auth.getClaims(token)
  if (result.error || result.data?.claims?.aal !== 'aal2') throw new Error('Verify your authenticator code in the portal before continuing.')
}
