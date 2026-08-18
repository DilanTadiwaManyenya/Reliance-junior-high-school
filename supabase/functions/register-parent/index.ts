import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { internalEmailForPhone, isInternationalPhone, normalizePhone } from '../../../shared/portalPhone.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const { fullName, phone: rawPhone, password, admissionNumber, dateOfBirth } = await request.json()
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

    // createUser never sends an email.  The email is only an internal identifier for phone-based login.
    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email: internalEmailForPhone(phone),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone },
    })
    if (createError) throw createError

    const { data: student, error: studentError } = await serviceClient
      .from('students')
      .select('id')
      .eq('admission_number', admissionNumber)
      .eq('date_of_birth', dateOfBirth)
      .maybeSingle()
    if (studentError) throw studentError
    if (student) {
      const { error: linkError } = await serviceClient
        .from('parent_student')
        .upsert({ parent_id: created.user.id, student_id: student.id, verified_at: new Date().toISOString() }, { onConflict: 'parent_id,student_id' })
      if (linkError) throw linkError
    }

    return Response.json({ created: true, matchedStudent: Boolean(student) }, { headers: corsHeaders })
  } catch (error) {
    console.error(error)
    return Response.json(
      { error: error && typeof error === 'object' && 'message' in error ? error.message : 'Account creation failed.' },
      { status: 400, headers: corsHeaders },
    )
  }
})
