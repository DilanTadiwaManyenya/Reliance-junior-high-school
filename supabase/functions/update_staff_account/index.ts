import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const phone = (value: unknown) => { const raw = String(value ?? '').replace(/\D/g, ''); return raw.startsWith('0') ? `+263${raw.slice(1)}` : raw.startsWith('263') ? `+${raw}` : String(value ?? '').replace(/[\s-]/g, '') }
const validPhone = (value: string) => /^\+[1-9]\d{7,14}$/.test(value)
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user } } = await admin.auth.getUser(token)
    const { data: caller } = await admin.from('profiles').select('role').eq('id', user?.id).single()
    if (!user || caller?.role !== 'admin') throw new Error('Only an administrator can update staff accounts.')
    const input = await request.json(), staffId = String(input.user_id ?? '')
    if (!staffId) throw new Error('A staff account is required.')
    const update: Record<string, unknown> = {}
    if (input.phone !== undefined) { const number = phone(input.phone); if (!validPhone(number)) throw new Error('Enter a valid phone number.'); update.phone = number }
    const password = input.password === undefined ? '' : String(input.password)
    if (password && password.length < 8) throw new Error('Reset passwords must be at least 8 characters.')
    if (Object.keys(update).length || password) {
      const authUpdate: Record<string, string> = {}; if (update.phone) authUpdate.email = `portal-${String(update.phone).slice(1)}@portal.reliance.local`; if (password) authUpdate.password = password
      const { error } = await admin.auth.admin.updateUserById(staffId, authUpdate); if (error) throw error
    }
    if (update.phone) { await admin.from('profiles').update({ phone: update.phone }).eq('id', staffId); await admin.from('staff_accounts').update({ phone_number: update.phone }).eq('user_id', staffId) }
    if (password) await admin.from('profiles').update({ must_update_credentials: true }).eq('id', staffId)
    return reply({ success: true })
  } catch (error) { return reply({ success: false, error: error instanceof Error ? error.message : 'Unable to update staff account.' }, 400) }
})
