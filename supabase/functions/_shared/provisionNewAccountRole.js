// Call only for an Auth account just created by a validated service-side workflow.
// Auth metadata may be persisted after INSERT triggers; provision DB authority explicitly.
export async function provisionNewAccountRole(client, userId, role) {
  if (!['admin','principal','teacher','accountant','student'].includes(role)) throw new Error('Invalid account role.')
  const profile = await client.from('profiles').update({role,active_role:role}).eq('id',userId).select('id').single()
  if (profile.error || !profile.data) throw new Error('Unable to provision the new account profile.')
  const membership = await client.from('user_roles').upsert({user_id:userId,role},{onConflict:'user_id,role'})
  if (membership.error) throw new Error('Unable to provision the new account membership.')
  const bootstrap = await client.from('user_roles').delete().eq('user_id',userId).eq('role','parent')
  if (bootstrap.error) throw new Error('Unable to finish the new account role setup.')
}
