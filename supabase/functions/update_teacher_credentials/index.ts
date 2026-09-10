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
    const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single()

    let targetUserId = user.id
    if (caller?.role === 'admin') {
      targetUserId = String(input.user_id || input.target_user_id || user.id)
    } else if (caller?.role !== 'teacher') {
      throw new Error('Only teachers or administrators can update credentials.')
    }

    const nextPhone = phone(input.phone)
    const password = String(input.password ?? '')
    if (!validPhone(nextPhone)) throw new Error('Enter a valid international phone number.')
    if (password.length < 8) throw new Error('Choose a password of at least 8 characters.')

    const { data: duplicate } = await admin.from('profiles').select('id').eq('phone', nextPhone).neq('id', targetUserId).maybeSingle()
    if (duplicate) throw new Error('That phone number is already registered.')

    const updatedEmail = portalEmail(nextPhone)
    const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, { email: updatedEmail, password })
    if (authError) throw authError

    const { error: profileError } = await admin.from('profiles').update({ phone: nextPhone, must_update_credentials: false }).eq('id', targetUserId)
    if (profileError) throw profileError

    const { error: accountError } = await admin.from('staff_accounts').update({ phone_number: nextPhone }).eq('user_id', targetUserId)
    if (accountError) throw accountError

    return reply({ success: true, user_id: targetUserId, email: updatedEmail })
  } catch (error) { return reply({ success: false, error: error instanceof Error ? error.message : 'Unable to update credentials.' }, 400) }
})
