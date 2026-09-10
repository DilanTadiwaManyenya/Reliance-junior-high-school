import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const roles = new Set(['admin', 'principal', 'teacher', 'accountant'])
const normalizePhone = (value: unknown) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('0')) return `+263${digits.slice(1)}`
  return digits.startsWith('263') ? `+${digits}` : `+${digits}`
}
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return reply({ error: 'Use POST.' }, 405)
  let createdUserId: string | null = null
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) throw new Error('Your session has expired. Please sign in again.')
    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) throw new Error('Your session has expired. Please sign in again.')
    const { data: caller, error: callerError } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (callerError || caller?.role !== 'admin') throw new Error('Only administrators can create staff accounts.')

    const input = await request.json()
    const fullName = String(input.fullName ?? input.name ?? '').trim()
    const phone = normalizePhone(input.phone ?? input.phone_number)
    const password = String(input.password ?? '')
    const role = String(input.role ?? '')
    const classLevel = String(input.classLevel ?? '').trim()
    const classStream = String(input.classStream ?? '').trim()
    const classAssigned = role === 'teacher' ? `${classLevel} ${classStream}`.trim() : null

    if (!fullName) throw new Error('Enter the staff member’s full name.')
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Enter a valid international phone number.')
    if (password.length < 8) throw new Error('The password must be at least 8 characters.')
    if (!roles.has(role)) throw new Error('Choose a valid staff role.')
    if (role === 'teacher' && (!classLevel || !classStream)) throw new Error('Teachers require both a class level and stream.')

    const { data: existing, error: duplicateError } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle()
    if (duplicateError) throw duplicateError
    if (existing) throw new Error('This phone number is already registered.')

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: `portal-${phone.slice(1)}@portal.reliance.local`, password, email_confirm: true,
      user_metadata: { full_name: fullName, phone, role }
    })
    if (createError || !created.user) throw createError ?? new Error('Supabase could not create the login account.')
    createdUserId = created.user.id

    const profile = await admin.from('profiles').update({ full_name: fullName, phone, role, class_level: role === 'teacher' ? classLevel : null, class_stream: role === 'teacher' ? classStream : null }).eq('id', createdUserId)
    if (profile.error) throw profile.error
    const account = await admin.from('staff_accounts').upsert({ user_id: createdUserId, role, phone_number: phone, name: fullName, class_assigned: classAssigned, created_by: user.id }, { onConflict: 'user_id' })
    if (account.error) throw account.error

    return reply({ success: true, message: 'Staff account created successfully.' })
  } catch (error) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId)
    const message = error instanceof Error ? error.message : 'Account creation failed.'
    console.error(message)
    return reply({ success: false, error: message }, 400)
  }
})