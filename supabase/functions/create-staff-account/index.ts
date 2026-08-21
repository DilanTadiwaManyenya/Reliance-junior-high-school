import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const INTERNATIONAL_PHONE = /^\+[1-9]\d{7,14}$/
const normalizePhone = (raw: unknown) => {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}
const isInternationalPhone = (phone: string) => INTERNATIONAL_PHONE.test(phone)
const buildPortalEmail = (phone: unknown) =>
  `portal-${normalizePhone(phone).replace(/^\+/, '')}@portal.reliance.local`
const allowedRoles = new Set(['teacher', 'accountant', 'admin', 'principal'])
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) throw new Error('Authentication is required.')
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: { user }, error: userError } = await client.auth.getUser(authorization.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Authentication is required.')
    const { data: caller } = await client.from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'principal'].includes(caller?.role ?? '')) throw new Error('Only administrators and principals can create staff accounts.')
    const { fullName, phone: rawPhone, password, role, classLevel, classStream } = await request.json()
    const phone = normalizePhone(rawPhone)
    if (!fullName?.trim() || !isInternationalPhone(phone)) throw new Error('Enter a full name and valid international phone number.')
    if (!password || password.length < 8) throw new Error('The password must be at least 8 characters.')
    if (!allowedRoles.has(role)) throw new Error('Choose a valid staff role.')
    if (role === 'teacher' && (!classLevel?.trim() || !classStream?.trim())) throw new Error('Teachers need both a class level and stream.')
    const { data: exists } = await client.from('profiles').select('id').eq('phone', phone).maybeSingle()
    if (exists) throw new Error('This phone number is already registered.')
    const { data: created, error: createError } = await client.auth.admin.createUser({ email: buildPortalEmail(phone), password, email_confirm: true, user_metadata: { full_name: fullName.trim(), phone } })
    if (createError || !created.user) throw createError ?? new Error('Could not create the staff account.')
    const { error: profileError } = await client.from('profiles').update({ full_name: fullName.trim(), phone, role, class_level: role === 'teacher' ? classLevel.trim() : null, class_stream: role === 'teacher' ? classStream.trim() : null }).eq('id', created.user.id)
    if (profileError) throw profileError
    return Response.json({ message: 'Staff account created successfully.' }, { headers })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not create staff account.' }, { status: 400, headers })
  }
})
