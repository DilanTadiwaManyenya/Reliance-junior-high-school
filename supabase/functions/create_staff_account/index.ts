import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const roles = new Set(['admin', 'principal', 'teacher', 'accountant'])
const phone = (value: unknown) => { const raw = String(value ?? '').replace(/\D/g, ''); return raw.startsWith('0') ? `+263${raw.slice(1)}` : raw.startsWith('263') ? `+${raw}` : String(value ?? '').replace(/[\s-]/g, '') }
const validPhone = (value: string) => /^\+2637[1-8]\d{7}$/.test(value)
const temporaryPassword = () => `${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}Aa!`
const response = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return response({ success: false, error: 'method_not_allowed', message: 'Use POST.' }, 405)
  let createdUserId: string | null = null
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) throw new Error('Authentication is required.')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) throw new Error('Authentication is required.')
    const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (caller?.role !== 'admin') throw new Error('Only administrators can create staff accounts.')
    const input = await request.json()
    const name = String(input.name ?? input.fullName ?? '').trim(), number = phone(input.phone_number ?? input.phone), role = String(input.role ?? '')
    const classAssigned = input.class_assigned ?? input.classAssigned ?? (input.classLevel && input.classStream ? `${input.classLevel} ${input.classStream}` : null)
    const campus = input.campus ?? null
    if (!name || !validPhone(number) || !roles.has(role)) throw new Error('Provide a name, a valid Zimbabwe phone number, and a valid role.')
    if (role === 'teacher' && !String(classAssigned ?? '').trim()) throw new Error('Teachers require a class assignment.')
    if (campus !== null && !['junior', 'senior'].includes(campus)) throw new Error('Campus must be junior or senior.')
    const { data: duplicate } = await admin.from('profiles').select('id').eq('phone', number).maybeSingle()
    if (duplicate) throw new Error('This phone number is already registered.')
    const tempPassword = temporaryPassword()
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email: `portal-${number.slice(1)}@portal.reliance.local`, password: tempPassword, email_confirm: true, user_metadata: { full_name: name, phone: number } })
    if (createError || !created.user) throw createError ?? new Error('Unable to create the user.')
    createdUserId = created.user.id
    const profile = await admin.from('profiles').update({ full_name: name, phone: number, role, class_level: role === 'teacher' ? String(classAssigned).split(' ')[0] : null, class_stream: role === 'teacher' ? String(classAssigned).split(' ').slice(1).join(' ') || null : null, campus }).eq('id', createdUserId)
    if (profile.error) throw profile.error
    const account = await admin.from('staff_accounts').insert({ user_id: createdUserId, role, phone_number: number, name, class_assigned: classAssigned, campus, created_by: user.id })
    if (account.error) throw account.error
    return response({ success: true, data: { user_id: createdUserId, temp_password: tempPassword }, user_id: createdUserId, temp_password: tempPassword, message: 'Staff account created.' })
  } catch (error) {
    if (createdUserId) { const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); await admin.auth.admin.deleteUser(createdUserId) }
    const detail = error instanceof Error ? error.message : 'Account creation failed.'
    return response({ success: false, error: detail, message: 'We could not create the staff account.' }, 400)
  }
})
