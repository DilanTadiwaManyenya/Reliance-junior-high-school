import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const INTERNATIONAL_PHONE = /^\+[1-9]\d{7,14}$/
const normalizePhone = (raw: unknown) => {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}
const isInternationalPhone = (phone: string) => INTERNATIONAL_PHONE.test(phone)
const buildPortalEmail = (phone: unknown) =>
  `portal-${normalizePhone(phone).replace(/^\+/, '')}@portal.reliance.local`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  try {
    const { fullName, phone: rawPhone, password, admissionNumber, dateOfBirth } = await request.json()
    const phone = normalizePhone(rawPhone)
    if (!fullName || !isInternationalPhone(phone)) throw new Error('Enter a valid international phone number.')
    if (!password || password.length < 8) throw new Error('The password must be at least 8 characters.')
    if (!admissionNumber || !dateOfBirth) throw new Error('Enter your admission number and date of birth.')
    const service = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: student, error: matchError } = await service.from('students').select('id').eq('admission_number', admissionNumber).eq('date_of_birth', dateOfBirth).is('auth_user_id', null).maybeSingle()
    if (matchError) throw matchError
    if (!student) throw new Error("We couldn't verify those details — please check the admission number and date of birth with the school office.")
    const { data: existing, error: profileLookupError } = await service.from('profiles').select('id').eq('phone', phone).maybeSingle()
    if (profileLookupError) throw profileLookupError
    if (existing) throw new Error('This phone number is already registered. Please sign in instead.')
    const { data: created, error: createError } = await service.auth.admin.createUser({ email: buildPortalEmail(phone), password, email_confirm: true, user_metadata: { full_name: fullName, phone } })
    if (createError) throw createError
    const { error: linkError } = await service.from('students').update({ auth_user_id: created.user.id }).eq('id', student.id).is('auth_user_id', null)
    if (linkError) throw linkError
    const { error: profileError } = await service.from('profiles').update({ role: 'student' }).eq('id', created.user.id)
    if (profileError) throw profileError
    return Response.json({ created: true }, { headers: corsHeaders })
  } catch (error) {
    console.error(error)
    return Response.json({ error: error && typeof error === 'object' && 'message' in error ? error.message : 'Account creation failed.' }, { status: 400, headers: corsHeaders })
  }
})
