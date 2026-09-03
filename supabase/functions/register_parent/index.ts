import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const normalise = (value: unknown) => { const raw = String(value ?? '').replace(/\D/g, ''); return raw.startsWith('0') ? `+263${raw.slice(1)}` : raw.startsWith('263') ? `+${raw}` : String(value ?? '').replace(/[\s-]/g, '') }
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers })
const dateOk = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  let userId: string | null = null
  try {
    const input = await request.json(), phone = normalise(input.phone_number ?? input.phone), password = String(input.password ?? ''), admission = String(input.child_admission_number ?? input.admissionNumber ?? '').trim(), dob = input.date_of_birth ?? input.dateOfBirth
    if (!/^\+2637[1-8]\d{7}$/.test(phone) || password.length < 8 || !admission || !dateOk(dob)) throw new Error('Provide a valid Zimbabwe phone number, password, admission number, and ISO date of birth.')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: verified, error: verifyError } = await admin.rpc('verify_parent_admission', { admission_number: admission, dob })
    if (verifyError) throw verifyError
    if (!verified) throw new Error('Admission number/DOB mismatch')
    const { data: duplicate } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle()
    if (duplicate) throw new Error('This phone number is already registered.')
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email: `portal-${phone.slice(1)}@portal.reliance.local`, password, email_confirm: true, user_metadata: { full_name: String(input.name ?? input.fullName ?? '').trim(), phone } })
    if (createError || !created.user) throw createError ?? new Error('Unable to create the user.')
    userId = created.user.id
    const { data: student, error: studentError } = await admin.from('students').select('id').eq('admission_number', admission).eq('date_of_birth', dob).maybeSingle()
    if (studentError || !student) throw studentError ?? new Error('Admission number/DOB mismatch')
    const now = new Date().toISOString()
    const account = await admin.from('parent_accounts').insert({ user_id: userId, phone_number: phone, child_admission_number: admission, verified: true, verified_at: now })
    const link = await admin.from('parent_student').upsert({ parent_id: userId, student_id: student.id, verified_at: now }, { onConflict: 'parent_id,student_id' })
    if (account.error || link.error) throw account.error ?? link.error
    return reply({ success: true, data: { user_id: userId }, user_id: userId, message: 'Account created, you can now login.' })
  } catch (error) {
    if (userId) { const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!); await admin.auth.admin.deleteUser(userId) }
    const detail = error instanceof Error ? error.message : 'Account creation failed.'
    return reply({ success: false, error: detail, message: detail === 'Admission number/DOB mismatch' ? detail : 'We could not create your account.' }, 400)
  }
})
