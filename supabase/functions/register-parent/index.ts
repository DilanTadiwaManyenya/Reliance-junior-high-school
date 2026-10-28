import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Keep the deployed function self-contained: the Dashboard editor cannot
// bundle imports that resolve outside supabase/functions.
const normalizeStudentAdmission = (value: unknown) => String(value ?? '').trim()
  .replace(/^(\d{2})([fg])/i, (_, year, code) => year + code.toLowerCase())
  .replace(/^(\d{2})e([ab])/i, (_, year, code) => year + 'e' + code.toUpperCase())
const validStudentAdmission = (value: string) => /^(?:\d{4,6}|\d{2}(?:f[1-6]|g[1-7]|e[AB])\d{2,3})$/.test(value)
const validStudentBirthDate = (value: string, today = new Date().toISOString().slice(0, 10)) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return false
  const date = new Date(value + 'T00:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const parseTypedBirthDate = (value: unknown, today = new Date().toISOString().slice(0, 10)) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  let day, month, year
  if (match) [, year, month, day] = match.map(Number)
  else {
    match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
    if (match) [, day, month, year] = match.map(Number)
    else {
      const digits = text.replace(/\D/g, '')
      if (!/^\d{8}$/.test(digits)) return ''
      day = Number(digits.slice(0, 2)); month = Number(digits.slice(2, 4)); year = Number(digits.slice(4))
    }
  }
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) return ''
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  const iso = date.toISOString().slice(0, 10)
  return Number(iso.slice(0, 4)) === year && Number(iso.slice(5, 7)) === month && Number(iso.slice(8, 10)) === day && validStudentBirthDate(iso, today) ? iso : ''
}
const normalizeParentLearnerDetails = (admissionNumber: unknown, dateOfBirth: unknown) => {
  const admission = normalizeStudentAdmission(admissionNumber)
  const birthDate = parseTypedBirthDate(dateOfBirth)
  if (!validStudentAdmission(admission) || !birthDate) return null
  return { admissionNumber: admission, dateOfBirth: birthDate }
}

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
    const learnerDetails = normalizeParentLearnerDetails(rawAdmissionNumber, dateOfBirth)
    const phone = normalizePhone(rawPhone)
    if (!fullName || !isInternationalPhone(phone)) throw new Error('Enter a valid international phone number.')
    if (!password || password.length < 8) throw new Error('The password must be at least 8 characters.')
    if (!learnerDetails) throw new Error('Enter a valid learner admission number and date of birth.')
    const { admissionNumber, dateOfBirth: normalizedBirthDate } = learnerDetails

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
      .eq('admission_number', admissionNumber)
      .eq('date_of_birth', normalizedBirthDate)
      .maybeSingle()
    if (studentError) throw studentError
    if (!student) throw new Error('We could not verify that admission number and date of birth. Please check them and try again.')

    const { data: existingLink, error: existingLinkError } = await serviceClient
      .from('parent_student')
      .select('student_id')
      .eq('student_id', student.id)
      .maybeSingle()
    if (existingLinkError) throw existingLinkError
    if (existingLink) throw new Error('This learner is already linked to a parent account. Please contact the school office.')

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
    if (linkError?.code === '23505') {
      throw new Error('This learner is already linked to a parent account. Please contact the school office.')
    }
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
