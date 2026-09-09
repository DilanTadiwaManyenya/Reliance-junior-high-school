import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers })
const teachers = [
  ['Mr Munyembe', [['Form 1','Red'],['Form 1','Blue'],['Upper 6','Arts']]], ['Mr Chayabanda', [['Form 1','Green'],['Form 1','White']]],
  ['Mr Feya', [['Form 2','Red']]], ['Mr Makusha', [['Form 2','Blue'],['Form 2','Green']]], ['Mr Gopito', [['Form 3','Red'],['Form 3','Blue']]],
  ['Mr Kufamuni', [['Form 3','Purple']]], ['Ms Chakwesha', [['Form 3','Green'],['Form 3','White']]], ['Mr Size', [['Form 4','Red']]],
  ['Mr Mudzimirema', [['Form 4','Blue']]], ['Ms Mukote', [['Form 4','White']]], ['Mr Mahachi', [['Form 4','Green']]],
  ['Mr Svudu', [['Lower 6','Commercials']]], ['Mrs Kodzomoyo', [['Lower 6','Arts']]], ['Mr Mabvuramiti', [['Upper 6','Commercials']]],
  ['Mr Nyamutswa', []], ['Mr Chigova', []], ['Mr Tembo', []],
] as const
const subjects = [
  ['Mathematics','Form 1','Mr Kufamuni'],['Mathematics','Form 2','Mr Nyamutswa'],['Mathematics','Form 3','Mr Gopito'],['Mathematics','Form 4','Mr Chigova'],['Mathematics','Form 5','Mr Chigova'],['Mathematics','Form 6','Mr Chigova'],
  ['English','Form 1','Mr Munyembe'],['English','Form 2','Mr Munyembe'],['English','Form 3','Mr Munyembe'],['English','Form 4','Mrs Kodzomoyo'],['English','Form 5','Mrs Kodzomoyo'],
  ['Combined Science','Form 1','Mr Makusha'],['Combined Science','Form 2','Mr Makusha'],['Combined Science','Form 3','Mr Kufamuni'],['Combined Science','Form 4','Mr Tembo'],['Combined Science','Form 5','Ms Chakwesha'],['Combined Science','Form 6','Ms Chakwesha'],
  ['Shona','Form 1','Ms Chakwesha'],['Shona','Form 2','Ms Mukote'],['Shona','Form 3','Ms Chakwesha'],['Shona','Form 4','Ms Mukote'],['Shona','Form 5','Mr Nyamutswa'],['Shona','Form 6','Mr Nyamutswa'],
  ['Accounting','Form 1','Mr Mahachi'],['Accounting','Form 2','Mr Svudu'],['Accounting','Form 3','Mr Mahachi'],['Accounting','Form 4','Mr Mahachi'],['Accounting','Form 5','Mrs Kodzomoyo'],
  ['Geography','Form 1','Mr Chayabanda'],['Geography','Form 2','Mr Mudzimirema'],['Geography','Form 3','Mr Chayabanda'],['Geography','Form 4','Mr Mudzimirema'],['Geography','Form 5','Mrs Kodzomoyo'],['Geography','Form 6','Mr Mabvuramiti'],
  ['BES','Form 1','Mr Chayabanda'],['BES','Form 2','Mr Size'],['BES','Form 3','Mr Svudu'],['BES','Form 4','Mr Size'],['BES','Form 5','Mr Gopito'],['BES','Form 6','Mr Gopito'],
  ['History','Form 1','Mr Feya'],['History','Form 2','Mr Ngwarayi'],['History','Form 5','Mr Tembo'],['History','Form 6','Mr Tembo'],
  ['Heritage','Form 2','Mr Feya'],['Heritage','Form 3','Mr Feya'],['Heritage','Form 4','Mr Mabvuramiti'],['Heritage','Form 5','Mr Svudu'],['Heritage','Form 6','Mr Svudu'],
  ['Chemistry','Form 5','Mr Kufamuni'],['Chemistry','Form 6','Mr Mabvuramiti'],['Physics','Form 5','Mr Makusha'],['Physics','Form 6','Mrs Kodzomoyo'],['Biology','Form 5','Mr Gopito'],['Biology','Form 6','Mrs Kodzomoyo'],['FRS','Form 5','Mr Mabvuramiti'],['FRS','Form 6','Mr Mabvuramiti'],['English Literature','Form 5','Mrs Kodzomoyo'],['English Literature','Form 6','Mrs Kodzomoyo'],
] as const

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user } } = await admin.auth.getUser(token)
    const { data: caller } = await admin.from('profiles').select('role').eq('id', user?.id).single()
    if (!user || !['admin', 'principal'].includes(caller?.role ?? '')) throw new Error('Only an administrator or principal can run this seed.')
    const byName = new Map<string, string>(), credentials: object[] = []
    for (let i = 0; i < teachers.length; i++) {
      const [name, classes] = teachers[i], number = `+263790${String(i + 1).padStart(6, '0')}`, password = `RlcTemp!2026-${String(i + 1).padStart(2, '0')}`
      const { data: existing } = await admin.from('profiles').select('id').eq('full_name', name).eq('role', 'teacher').maybeSingle()
      let id = existing?.id
      if (!id) {
        const { data: created, error } = await admin.auth.admin.createUser({ email: `portal-${number.slice(1)}@portal.reliance.local`, password, email_confirm: true, user_metadata: { full_name: name, phone: number } })
        if (error || !created.user) throw error ?? new Error(`Could not create ${name}.`)
        id = created.user.id
        await admin.from('profiles').update({ full_name: name, phone: number, role: 'teacher', must_update_credentials: true }).eq('id', id)
        await admin.from('staff_accounts').insert({ user_id: id, role: 'teacher', phone_number: number, name, campus: 'senior', created_by: user.id })
        credentials.push({ name, temporary_phone: number, temporary_password: password })
      }
      byName.set(name, id!)
      if (classes.length) await admin.from('teacher_class_assignments').upsert(classes.map(([class_level, class_stream]) => ({ teacher_id: id, class_level, class_stream, campus: 'senior' })), { onConflict: 'teacher_id,class_level,class_stream' })
    }
    const rows = subjects.filter(([, , name]) => byName.has(name)).map(([subject, form_level, name]) => ({ teacher_id: byName.get(name), subject, form_level }))
    const { error: subjectError } = await admin.from('teacher_subject_assignments').upsert(rows, { onConflict: 'teacher_id,subject,form_level' })
    if (subjectError) throw subjectError
    return reply({ success: true, created_accounts: credentials, skipped_pending_confirmation: ['Mr Ngwarayi / Mr Ngwarai', 'Form 3 History', 'Form 6 English', 'Form 6 Accounting', 'Form 1 Heritage'] })
  } catch (error) { return reply({ success: false, error: error instanceof Error ? error.message : 'Seeding failed.' }, 400) }
})
