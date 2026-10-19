import { normalizeStudentAdmission, validStudentAdmission, validStudentBirthDate, studentPortalEmail } from '../../../shared/studentRegistration.js'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers })
const failure = (status = 400) => reply({ success: false, message: status === 503 ? 'Registration is temporarily unavailable. Please try again later.' : 'Unable to register with these details. Check with the school or sign in if already registered.' }, status)

// Dependency injection permits HTTP acceptance tests without real learner accounts.
export function registerStudentHandler(admin, report = () => {}) {
  return async request => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers })
    if (request.method !== 'POST') return reply({ success: false, message: 'Use POST.' }, 405)
    let userId = null
    try {
      const input = await request.json()
      if (!input || typeof input !== 'object' || Array.isArray(input)) return failure()
      const admission = normalizeStudentAdmission(input.admission_number ?? input.admissionNumber)
      const dob = String(input.date_of_birth ?? input.dateOfBirth ?? '')
      const password = String(input.password ?? '')
      const level = String(input.class_level ?? input.classLevel ?? '').trim()
      const stream = String(input.class_stream ?? input.classStream ?? '').trim()
      if (!validStudentAdmission(admission) || !validStudentBirthDate(dob) || !level || level.length > 80 || stream.length > 80) return failure()
      if (password.length > 128 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) return reply({ success: false, message: 'Use 8–128 characters with uppercase, lowercase and a number.' }, 400)
      const learner = await admin.from('students').select('id,full_name,class_level,class_stream,campus')
        .eq('admission_number', admission).eq('date_of_birth', dob).eq('status', 'active').is('auth_user_id', null).maybeSingle()
      if (learner.error) return failure(503)
      const student = learner.data
      const normalStream = value => !value || value === 'N/A' ? '' : value
      if (!student || student.class_level !== level || normalStream(student.class_stream) !== normalStream(stream) || !['junior', 'senior'].includes(student.campus)) return failure()
      const created = await admin.auth.admin.createUser({ email: studentPortalEmail(admission), password, email_confirm: true,
        app_metadata: { role: 'student' }, user_metadata: { full_name: student.full_name } })
      if (created.error || !created.data?.user) return failure(409)
      userId = created.data.user.id
      const linked = await admin.rpc('complete_student_registration', { p_user_id: userId, p_admission_number: admission, p_date_of_birth: dob, p_class_level: level, p_class_stream: stream })
      if (linked.error) throw new Error('registration_link_failed')
      return reply({ success: true, message: 'Account created successfully. You can now sign in.' })
    } catch {
      if (userId) {
        // A lost RPC response may follow a successful commit. Preserve that account.
        try {
          const [link, account] = await Promise.all([
            admin.from('students').select('id').eq('auth_user_id', userId).maybeSingle(),
            admin.from('student_accounts').select('id').eq('user_id', userId).maybeSingle(),
          ])
          if (!link.error && !account.error && link.data && account.data) return reply({ success: true, message: 'Account created successfully. You can now sign in.' })
          if (!link.error && !account.error && !link.data && !account.data) {
            const removed = await admin.auth.admin.deleteUser(userId)
            if (removed.error) report('registration_cleanup_failed')
          } else report('registration_outcome_unconfirmed')
        } catch { report('registration_outcome_unconfirmed') }
      }
      return failure(userId ? 503 : 400)
    }
  }
}
