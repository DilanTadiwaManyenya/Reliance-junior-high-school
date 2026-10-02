import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const INTERNATIONAL_PHONE = /^\+[1-9]\d{7,14}$/
const normalizePhone = (raw: unknown) => {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}
const isInternationalPhone = (phone: string) => INTERNATIONAL_PHONE.test(phone)
const buildPortalEmail = (phone: unknown) =>
  `portal-${normalizePhone(phone).replace(/^\+/, '')}@portal.reliance.local`

const messageFor = (error: unknown) =>
  error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : 'Account creation failed. Please try again.'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  let createdUserId: string | null = null
  try {
    const { fullName: rawFullName, phone: rawPhone, password, admissionNumber: rawAdmissionNumber, dateOfBirth } = await request.json()
    const fullName = String(rawFullName ?? '').trim()
    const admissionNumber = String(rawAdmissionNumber ?? '').trim()
    const phone = normalizePhone(rawPhone)
    if (!fullName || !isInternationalPhone(phone)) throw new Error('Enter a valid international phone number.')
    if (!password || password.length < 8) throw new Error('The password must be at least 8 characters.')
    if (!admissionNumber || !dateOfBirth) throw new Error('Enter the learner admission number and date of birth.')

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { data: existingProfile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()
    if (profileError) throw profileError
    if (existingProfile) throw new Error('This phone number is already registered. Please sign in instead.')

    // Check the learner before creating an Auth account. This avoids partial
    // registrations when an admission number or date of birth is incorrect.
    const { data: student, error: studentError } = await serviceClient
      .from('students')
      .select('id')
      .ilike('admission_number', admissionNumber)
      .eq('date_of_birth', dateOfBirth)
      .maybeSingle()
    if (studentError) throw studentError
    if (!student) throw new Error('We could not verify that admission number and date of birth. Please check them and try again.')

    // createUser never sends an email. The email is only an internal identifier for phone-based login.
    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email: buildPortalEmail(phone),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone },
    })
    if (createError) throw createError
    if (!created.user) throw new Error('The account could not be created. Please try again.')
    createdUserId = created.user.id

    const now = new Date().toISOString()
    const { error: accountError } = await serviceClient
      .from('parent_accounts')
      .insert({ user_id: createdUserId, phone_number: phone, child_admission_number: admissionNumber, verified: true, verified_at: now })
    if (accountError) throw accountError

    const { error: linkError } = await serviceClient
      .from('parent_student')
      .upsert({ parent_id: createdUserId, student_id: student.id, verified_at: now }, { onConflict: 'parent_id,student_id' })
    if (linkError) throw linkError

    return Response.json({ created: true, matchedStudent: true }, { headers: corsHeaders })
  } catch (error) {
    // If a post-creation step fails, leave no unusable Auth account behind.
    if (createdUserId) {
      const serviceClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
      await serviceClient.auth.admin.deleteUser(createdUserId)
    }
    console.error(messageFor(error))
    return Response.json(
      { error: messageFor(error) },
      { status: 400, headers: corsHeaders },
    )
  }
})
