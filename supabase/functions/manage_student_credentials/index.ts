import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers })
const normalisePhone = (value: unknown) => { const digits = String(value ?? '').replace(/\D/g, ''); return digits.startsWith('0') ? `+263${digits.slice(1)}` : digits.startsWith('263') ? `+${digits}` : String(value ?? '').trim() }

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) throw new Error('Authentication is required.')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user } } = await admin.auth.getUser(token)
    if (!user) throw new Error('Authentication is required.')
    const input = await request.json()
    const { data: caller } = await admin.from('profiles').select('role, class_level, class_stream').eq('id', user.id).maybeSingle()
    if (!caller || !['teacher', 'admin', 'principal'].includes(caller.role)) throw new Error('Only authorised teaching staff can manage learner accounts.')
    const { data: student } = await admin.from('students').select('id, class_level, class_stream, auth_user_id').eq('id', input.studentId).maybeSingle()
    if (!student) throw new Error('Learner not found.')
    const teacherCanManage = caller.role === 'teacher' && student.class_level === caller.class_level && (!caller.class_stream || student.class_stream === caller.class_stream)
    if (caller.role === 'teacher' && !teacherCanManage) throw new Error('You can only manage learners assigned to your class.')
    const operation = String(input.operation || '')
    const { data: account } = await admin.from('student_accounts').select('user_id').eq('admission_number', (await admin.from('students').select('admission_number').eq('id', student.id).single()).data?.admission_number).maybeSingle()
    const accountUserId = student.auth_user_id || account?.user_id
    if (operation === 'update_phone') {
      const phone = normalisePhone(input.phone)
      if (!/^\+2637[1-8]\d{7}$/.test(phone)) throw new Error('Enter a valid Zimbabwe mobile number.')
      await admin.from('students').update({ parent_phone: phone }).eq('id', student.id)
      if (accountUserId) { await admin.auth.admin.updateUserById(accountUserId, { phone, email: `portal-${phone.slice(1)}@portal.reliance.local` }); await admin.from('student_accounts').update({ phone_number: phone }).eq('user_id', accountUserId) }
      return reply({ message: 'Learner contact number updated.' })
    }
    if (operation === 'reset_password') {
      const password = String(input.password || '')
      if (password.length < 8) throw new Error('Temporary password must be at least 8 characters.')
      if (!accountUserId) throw new Error('This learner does not have an activated portal account.')
      const { error } = await admin.auth.admin.updateUserById(accountUserId, { password })
      if (error) throw error
      return reply({ message: 'Temporary password set. Ask the learner to change it at next sign-in.' })
    }
    throw new Error('Unsupported learner account action.')
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Unable to update learner account.' }, 400) }
})
