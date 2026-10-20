import { requireAdminMfa } from '../_shared/adminMfa.js'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const phone = (value: unknown) => { const raw = String(value ?? '').replace(/\D/g, ''); return raw.startsWith('0') ? `+263${raw.slice(1)}` : raw.startsWith('263') ? `+${raw}` : String(value ?? '').replace(/[\s-]/g, '') }
const validPhone = (value: string) => /^\+[1-9]\d{7,14}$/.test(value)
const portalEmail = (number: string) => `portal-${number.slice(1)}@portal.reliance.local`
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405)
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user } } = await admin.auth.getUser(token)
    if (!user) throw new Error('Authentication is required.')

    const input = await request.json()
    const { data: caller, error: callerError } = await admin.from('profiles').select('role, active_role, campus').eq('id', user.id).single()
    if (callerError) throw new Error('Unable to load your staff permissions. Refresh and try again.')

    if (caller?.role === 'admin') await requireAdminMfa(admin, token)
    let targetUserId = user.id
    if (caller?.role === 'admin' && caller?.active_role === 'admin' && ['junior','senior','all'].includes(caller?.campus ?? '')) {
      targetUserId = String(input.user_id || input.target_user_id || user.id)
    } else if (caller?.role !== 'teacher') {
      throw new Error('Only teachers or administrators can update credentials.')
    }

    const { data: targetProfile, error: targetProfileError } = await admin.from('profiles').select('is_protected, role, campus, phone').eq('id', targetUserId).maybeSingle()
    if (targetProfileError) throw new Error('Unable to load the selected staff profile. Refresh and try again.')
    if (!targetProfile) throw new Error('The target profile was not found.')
    if (targetProfile.is_protected && targetUserId !== user.id) {
      throw new Error('The protected primary administrator can change credentials only on their own signed-in account.')
    }
    if (caller?.role === 'admin' && targetUserId !== user.id && caller.campus !== 'all' && (targetProfile.campus !== caller.campus || targetProfile.role === 'admin')) {
      throw new Error('Campus Admins can reset credentials only for non-admin staff in their own campus.')
    }

    const nextPhone = phone(input.phone)
    const password = String(input.password ?? '')
    if (!validPhone(nextPhone)) throw new Error('Enter a valid international phone number.')
    if (password.length < 8) throw new Error('Choose a password of at least 8 characters.')

    const { data: duplicate, error: duplicateError } = await admin.from('profiles').select('id').eq('phone', nextPhone).neq('id', targetUserId).maybeSingle()
    if (duplicateError) throw new Error('Unable to check whether that phone number is already in use. Try again.')
    if (duplicate) throw new Error('That phone number is already registered.')

    const { data: targetAuth, error: targetAuthError } = await admin.auth.admin.getUserById(targetUserId)
    if (targetAuthError || !targetAuth.user) throw new Error('The staff profile has no readable login account in Supabase Auth. No credentials were changed; ask the Main Admin to repair this account.')
    const updatedEmail = portalEmail(nextPhone)
    const authUpdate: { email?: string, password: string } = { password }
    // Avoid submitting an unchanged email. Supabase Auth can treat a no-op email
    // update as a second identity change while this flow is only resetting a password.
    if (targetAuth.user.email !== updatedEmail) authUpdate.email = updatedEmail
    const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, authUpdate)
    if (authError) throw authError

    const adminSetPasswordForAnotherUser = caller?.role === 'admin' && targetUserId !== user.id
    const profileUpdate = { must_update_credentials: false, must_change_password: adminSetPasswordForAnotherUser, ...(targetProfile.phone === nextPhone ? {} : { phone: nextPhone }) }
    const { error: profileError } = await admin.from('profiles').update(profileUpdate).eq('id', targetUserId)
    if (profileError) throw profileError

    if (targetProfile.phone !== nextPhone) {
      const { error: accountError } = await admin.from('staff_accounts').update({ phone_number: nextPhone }).eq('user_id', targetUserId)
      if (accountError) throw accountError
    }

    return reply({ success: true, user_id: targetUserId, email: updatedEmail })
  } catch (error) { return reply({ success: false, error: error instanceof Error ? error.message : 'Unable to update credentials.' }, 400) }
})
