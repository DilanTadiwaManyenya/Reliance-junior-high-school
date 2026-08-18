import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { internalEmailForPhone, isInternationalPhone, normalizePhone } from '../../../shared/portalPhone.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  try {
    const { fullName, phone: rawPhone, password, admissionNumber, dateOfBirth } = await request.json()
    const phone = normalizePhone(rawPhone)
    if (!fullName || !isInternationalPhone(phone)) throw new Error('Enter a valid international phone number.')
    if (!password || password.length < 8) throw new Error('The password must be at least 8 characters.')
    if (!admissionNumber || !dateOfBirth) throw new Error('Enter your admission number and date of birth.')
    const service = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: student, error: matchError } = await service.from('students').select('id, auth_user_id').eq('admission_number', admissionNumber).eq('date_of_birth', dateOfBirth).maybeSingle()
    if (matchError) throw matchError
    if (!student) throw new Error('We could not verify those learner details.')
    if (student.auth_user_id) throw new Error('This learner already has a student portal account.')
    const { data: existing } = await service.from('profiles').select('id').eq('phone', phone).maybeSingle()
    if (existing) throw new Error('This phone number is already registered. Please sign in instead.')
    const { data: created, error: createError } = await service.auth.admin.createUser({ email: internalEmailForPhone(phone).replace('parent-', 'student-'), password, email_confirm: true, user_metadata: { full_name: fullName, phone } })
    if (createError) throw createError
    const { error: profileError } = await service.from('profiles').update({ role: 'student' }).eq('id', created.user.id)
    if (profileError) throw profileError
    const { error: linkError } = await service.from('students').update({ auth_user_id: created.user.id }).eq('id', student.id).is('auth_user_id', null)
    if (linkError) throw linkError
    return Response.json({ created: true }, { headers: corsHeaders })
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Account creation failed.' }, { status: 400, headers: corsHeaders }) }
})
