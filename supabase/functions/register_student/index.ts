import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers })
const levels = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6']
const normalizePhone = (value: unknown) => { const raw = String(value ?? '').trim().replace(/[\s-]/g, ''); return raw.startsWith('0') ? `+263${raw.slice(1)}` : raw.startsWith('263') ? `+${raw}` : raw }
const validStream = (level: string, stream: string) => (['Form 5', 'Form 6'].includes(level) ? ['Commercials', 'Arts', 'Sciences'] : ['Blue', 'Green', 'White']).includes(stream)
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
const portalEmail = (phone: string) => `portal-${phone.slice(1)}@portal.reliance.local`

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  let userId: string | null = null
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try {
    const input = await request.json()
    const phoneNumber = normalizePhone(input.phone_number ?? input.phone)
    const password = String(input.password ?? '')
    const admissionNumber = String(input.admission_number ?? input.admissionNumber ?? '').trim()
    const dateOfBirth = String(input.date_of_birth ?? input.dateOfBirth ?? '').trim()
    const classLevel = String(input.class_level ?? input.classLevel ?? '').trim()
    const classStream = String(input.class_stream ?? input.classStream ?? '').trim()
    if (!/^\+2637[1-8]\d{7}$/.test(phoneNumber)) return reply({ success: false, error: 'invalid_phone', message: 'Enter a valid Zimbabwe mobile number.' }, 400)
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) return reply({ success: false, error: 'invalid_password', message: 'Use a password with at least 8 characters, uppercase, lowercase, and a number.' }, 400)
    if (!/^\d{4,6}$/.test(admissionNumber) || !validDate(dateOfBirth)) return reply({ success: false, error: 'verification_failed', message: 'Admission number or date of birth do not match our records.' }, 400)
    if (!levels.includes(classLevel) || !validStream(classLevel, classStream)) return reply({ success: false, error: 'invalid_class', message: 'Invalid class selection.' }, 400)
    const { data: verified, error: verifyError } = await admin.rpc('verify_student_admission', { admission_number: admissionNumber, dob: dateOfBirth })
    if (verifyError || !verified) return reply({ success: false, error: 'admission_mismatch', message: 'Admission number or date of birth incorrect.' }, 400)
    const [{ data: phoneAccount }, { data: admissionAccount }] = await Promise.all([admin.from('student_accounts').select('id').eq('phone_number', phoneNumber).maybeSingle(), admin.from('student_accounts').select('id').eq('admission_number', admissionNumber).maybeSingle()])
    if (phoneAccount) return reply({ success: false, error: 'duplicate_phone', message: 'Phone number already registered.' }, 409)
    if (admissionAccount) return reply({ success: false, error: 'duplicate_admission', message: 'Admission number already registered.' }, 409)
    const { data: student, error: studentError } = await admin.from('students').select('id, full_name').eq('admission_number', admissionNumber).eq('date_of_birth', dateOfBirth).is('auth_user_id', null).maybeSingle()
    if (studentError || !student) return reply({ success: false, error: 'verification_failed', message: 'Admission number or date of birth do not match our records.' }, 400)
    const { data: created, error: authError } = await admin.auth.admin.createUser({ email: portalEmail(phoneNumber), phone: phoneNumber, password, email_confirm: true, phone_confirm: true, user_metadata: { full_name: student.full_name, phone: phoneNumber } })
    if (authError || !created.user) return reply({ success: false, error: 'auth_error', message: authError?.message?.toLowerCase().includes('already') ? 'Phone number already registered.' : 'Account creation failed. Please try again.' }, 400)
    userId = created.user.id
    const { error: linkError } = await admin.from('students').update({ auth_user_id: userId }).eq('id', student.id).is('auth_user_id', null)
    if (linkError) throw linkError
    const { error: accountError } = await admin.from('student_accounts').insert({ user_id: userId, admission_number: admissionNumber, phone_number: phoneNumber, class_level: classLevel, class_stream: classStream, enrolled_year: 2026, verified: true, verified_at: new Date().toISOString() })
    if (accountError) throw accountError
    const { error: profileError } = await admin.from('profiles').upsert({ id: userId, role: 'student', phone: phoneNumber, full_name: student.full_name }, { onConflict: 'id' })
    if (profileError) throw profileError
    return reply({ success: true, user_id: userId, message: 'Account created successfully. You can now login.' })
  } catch (error) {
    if (userId) await admin.auth.admin.deleteUser(userId)
    console.error(error)
    return reply({ success: false, error: 'auth_error', message: 'Account creation failed. Please try again.' }, 400)
  }
})
