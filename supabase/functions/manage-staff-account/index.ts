import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return reply({ success: false, error: 'Use POST.' }, 405)

  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: { user } } = await admin.auth.getUser(token)
    if (!user) throw new Error('Authentication is required.')

    const { data: caller, error: callerError } = await admin
      .from('profiles')
      .select('role, active_role, campus')
      .eq('id', user.id)
      .single()
    if (callerError || caller?.role !== 'admin' || caller?.active_role !== 'admin' || !['junior', 'senior', 'all'].includes(caller?.campus ?? '')) {
      throw new Error('Switch to the Admin role before managing staff accounts.')
    }

    const input = await request.json()
    const userId = String(input.user_id ?? '')
    const action = String(input.action ?? '')
    if (!userId || userId === user.id) throw new Error('The Main Admin account cannot be managed here.')

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id, role, campus, is_protected')
      .eq('id', userId)
      .single()
    if (targetError || !target) throw new Error('Staff account not found.')
    if (target.is_protected) throw new Error('This protected account cannot be changed here.')
    const isMainAdmin = caller.campus === 'all'
    if (!isMainAdmin && (target.campus !== caller.campus || target.role === 'admin')) {
      throw new Error('Campus Admins can manage only non-admin staff in their own campus.')
    }

    if (action === 'deactivate' || action === 'reactivate') {
      const active = action === 'reactivate'
      const { error: profileError } = await admin
        .from('profiles')
        .update({ portal_access_enabled: active })
        .eq('id', userId)
      if (profileError) throw profileError
      const { error: authError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: active ? 'none' : '876000h',
      })
      if (authError) throw authError
      return reply({ success: true, message: active ? 'Staff account reactivated.' : 'Staff account deactivated.' })
    }

    if (action !== 'update') throw new Error('Choose a valid staff management action.')
    const fullName = String(input.full_name ?? '').trim()
    const campus = String(input.campus ?? '').trim()
    const classAssignments = Array.isArray(input.class_assignments)
      ? [...new Set(input.class_assignments.map(String).map((value: string) => value.trim()).filter(Boolean))]
      : []
    const classStream = String(input.class_stream ?? '').trim()
    const classSubjectAssignments = Array.isArray(input.class_subject_assignments)
      ? input.class_subject_assignments.map((entry: Record<string, unknown>) => ({
        subject: String(entry?.subject ?? '').trim(),
        class_level: String(entry?.class_level ?? '').trim(),
        class_stream: String(entry?.class_stream ?? '').trim(),
      }))
      : []
    if (!fullName) throw new Error('Enter the staff member’s full name.')
    if (!['junior', 'senior'].includes(campus)) throw new Error('Choose Junior or Senior campus.')
    if (!isMainAdmin && campus !== caller.campus) throw new Error('Campus Admins cannot move staff to another campus.')
    if (target.role === 'teacher' && !classAssignments.length) throw new Error('Assign at least one class to a teacher.')
    if (target.role === 'teacher' && campus === 'senior' && !classStream) throw new Error('Choose a stream for a Senior teacher.')
    if (target.role === 'teacher' && classAssignments.some((level: string) => (campus === 'junior') !== /^(ECD|Grade)/.test(level))) {
      throw new Error('Each selected class must belong to the selected campus.')
    }
    if (target.role === 'teacher' && classSubjectAssignments.some((assignment) =>
      !assignment.subject
      || !assignment.class_level
      || ((campus === 'junior') !== /^(ECD|Grade)/.test(assignment.class_level)),
    )) {
      throw new Error('Each subject allocation needs a valid form and subject.')
    }
    const duplicateSubjectAllocation = new Set<string>()
    for (const assignment of classSubjectAssignments) {
      const key = `${assignment.subject.toLowerCase()}|${assignment.class_level}|${assignment.class_stream}`
      if (duplicateSubjectAllocation.has(key)) throw new Error('A subject can be allocated only once to the same class.')
      duplicateSubjectAllocation.add(key)
    }

    const primaryClass = classAssignments[0] ?? null
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        full_name: fullName,
        campus,
        class_level: target.role === 'teacher' ? primaryClass : null,
        class_stream: target.role === 'teacher' ? (classStream || null) : null,
      })
      .eq('id', userId)
    if (profileError) throw profileError

    const { error: accountError } = await admin
      .from('staff_accounts')
      .update({ name: fullName, campus, class_assigned: target.role === 'teacher' ? `${primaryClass ?? ''} ${classStream}`.trim() || null : null })
      .eq('user_id', userId)
    if (accountError) throw accountError

    if (target.role === 'teacher') {
      const { error: removeAssignmentsError } = await admin
        .from('teacher_class_assignments')
        .delete()
        .eq('teacher_id', userId)
      if (removeAssignmentsError) throw removeAssignmentsError
      const { error: assignmentsError } = await admin
        .from('teacher_class_assignments')
        .insert(classAssignments.map((class_level: string) => ({
          teacher_id: userId,
          class_level,
          // The assignment table's legacy column is NOT NULL; Junior uses an empty stream.
          class_stream: classStream,
          campus,
        })))
      if (assignmentsError) throw assignmentsError

      // Keep the new precise allocations and the established report-card
      // subject table in sync while older portal pages transition to it.
      const { error: removeClassSubjectError } = await admin
        .from('teacher_class_subject_assignments')
        .delete()
        .eq('teacher_id', userId)
      if (removeClassSubjectError) throw removeClassSubjectError
      if (classSubjectAssignments.length) {
        const { error: classSubjectError } = await admin
          .from('teacher_class_subject_assignments')
          .insert(classSubjectAssignments.map((assignment) => ({
            teacher_id: userId,
            subject: assignment.subject,
            class_level: assignment.class_level,
            class_stream: assignment.class_stream,
            campus,
          })))
        if (classSubjectError) throw classSubjectError
      }

      const { error: removeSubjectError } = await admin
        .from('teacher_subject_assignments')
        .delete()
        .eq('teacher_id', userId)
      if (removeSubjectError) throw removeSubjectError
      const legacySubjectAssignments = [...new Map(classSubjectAssignments.map((assignment) => [
        `${assignment.subject.toLowerCase()}|${assignment.class_level}`,
        { teacher_id: userId, subject: assignment.subject, form_level: assignment.class_level },
      ])).values()]
      if (legacySubjectAssignments.length) {
        const { error: legacySubjectError } = await admin
          .from('teacher_subject_assignments')
          .insert(legacySubjectAssignments)
        if (legacySubjectError) throw legacySubjectError
      }
    }

    return reply({ success: true, message: 'Staff account updated.' })
  } catch (error) {
    return reply({ success: false, error: error instanceof Error ? error.message : 'Unable to manage staff account.' }, 400)
  }
})
