import { requireAdminMfa } from '../_shared/adminMfa.js'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers })

const workingTitles = new Set(['Mr', 'Ms', 'Mrs'])
const workingName = (legalFullName: string, workingTitle: string) => {
  const names = legalFullName.trim().split(/\s+/).filter(Boolean)
  return `${workingTitle} ${names.at(-1) ?? ''}`.trim()
}
const normalizeSubjectLabel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const curriculumGroupsForAssignment = (campus: string, level: string, stream: string) => {
  if (campus !== 'senior') return []
  if (['Form 1', 'Form 2'].includes(level)) return ['form_1_2_zgc']
  if (['Form 3', 'Form 4'].includes(level)) return ['form_3_4']
  if (level === 'Lower Six' || level === 'Upper Six') {
    const prefix = level === 'Lower Six' ? 'lower_six_' : 'upper_six_'
    return stream ? [`${prefix}${stream.toLowerCase()}`] : ['arts', 'commercials', 'sciences'].map(pathway => `${prefix}${pathway}`)
  }
  return []
}
const ensureSubjectSlotsAreAvailable = async (admin: ReturnType<typeof createClient>, campus: string, assignments: { subject: string, subject_id?: string | null, class_level: string, class_stream: string }[], excludedTeacherId?: string) => {
  if (!assignments.length) return
  const { data: existing, error } = await admin
    .from('teacher_class_subject_assignments')
    .select('teacher_id, subject, subject_id, class_level, class_stream')
    .eq('campus', campus)
  if (error) throw error
  const conflict = (existing ?? []).find(current => current.teacher_id !== excludedTeacherId && assignments.some(requested =>
    current.class_level === requested.class_level
    && ((current.subject_id && requested.subject_id && current.subject_id === requested.subject_id)
      || (!current.subject_id || !requested.subject_id) && normalizeSubjectLabel(current.subject.trim()) === normalizeSubjectLabel(requested.subject.trim()))
    && (!current.class_stream || !requested.class_stream || current.class_stream === requested.class_stream),
  ))
  if (conflict) throw new Error(`${conflict.subject} is already allocated for ${conflict.class_level}. Reassign it from the current teacher before assigning another teacher.`)
}

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

    await requireAdminMfa(admin, token)
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
    const legalFullName = String(input.legal_full_name ?? '').trim()
    const workingTitle = String(input.working_title ?? '').trim()
    const fullName = legalFullName ? workingName(legalFullName, workingTitle) : String(input.full_name ?? '').trim()
    const campus = String(input.campus ?? '').trim()
    const legacyClassStream = String(input.class_stream ?? '').trim()
    const seenClassAssignments = new Set<string>()
    const classAssignments = Array.isArray(input.class_assignments)
      ? input.class_assignments.flatMap((entry: unknown) => {
        const assignment = typeof entry === 'string' ? { class_level: entry, class_stream: legacyClassStream } : entry as Record<string, unknown>
        const class_level = String(assignment?.class_level ?? '').trim()
        const class_stream = String(assignment?.class_stream ?? '').trim()
        const key = `${class_level.toLowerCase()}|${class_stream.toLowerCase()}`
        if (!class_level || seenClassAssignments.has(key)) return []
        seenClassAssignments.add(key)
        return [{ class_level, class_stream }]
      })
      : []
    const classSubjectAssignments = Array.isArray(input.class_subject_assignments)
      ? input.class_subject_assignments.map((entry: Record<string, unknown>) => ({
        subject: String(entry?.subject ?? '').trim(),
        subject_id: String(entry?.subject_id ?? '').trim() || null,
        class_level: String(entry?.class_level ?? '').trim(),
        class_stream: String(entry?.class_stream ?? '').trim(),
      }))
      : []
    if (!fullName) throw new Error('Enter the staff member’s full name.')
    if (legalFullName && legalFullName.split(/\s+/).filter(Boolean).length < 2) throw new Error('Enter the staff member’s full legal name.')
    if (legalFullName && !workingTitles.has(workingTitle)) throw new Error('Choose Mr, Ms, or Mrs for the working name.')
    if (!['junior', 'senior'].includes(campus)) throw new Error('Choose Junior or Senior campus.')
    if (!isMainAdmin && campus !== caller.campus) throw new Error('Campus Admins cannot move staff to another campus.')
    if (campus === 'junior' && classSubjectAssignments.length) throw new Error('Junior School uses class-based teaching and does not accept subject allocations.')
    if (target.role === 'teacher' && classAssignments.some((assignment) => (campus === 'junior') !== /^(ECD|Grade)/.test(assignment.class_level))) {
      throw new Error('Each selected class must belong to the selected campus.')
    }
    if (target.role === 'teacher' && campus === 'junior' && classAssignments.some((assignment) => assignment.class_stream)) {
      throw new Error('Junior class allocations do not use streams.')
    }
    const assignmentsByClass = new Map<string, Set<string>>()
    for (const assignment of classAssignments) {
      const level = assignment.class_level.toLowerCase()
      const stream = assignment.class_stream.toLowerCase()
      const streams = assignmentsByClass.get(level) ?? new Set<string>()
      if (streams.has('') || !stream && streams.size || streams.has(stream)) throw new Error(`Choose either one whole-form allocation or distinct streams for ${assignment.class_level}.`)
      streams.add(stream)
      assignmentsByClass.set(level, streams)
    }
    if (target.role === 'teacher' && classSubjectAssignments.some((assignment) =>
      !assignment.subject
      || !assignment.class_level
      || ((campus === 'junior') !== /^(ECD|Grade)/.test(assignment.class_level)),
    )) {
      throw new Error('Each subject allocation needs a valid form and subject.')
    }
    if (target.role === 'teacher' && classSubjectAssignments.length) {
      const requestedAliases = [...new Set(classSubjectAssignments.map(assignment => normalizeSubjectLabel(assignment.subject)).filter(Boolean))]
      const requestedGroups = [...new Set(classSubjectAssignments.flatMap(assignment => curriculumGroupsForAssignment(campus, assignment.class_level, assignment.class_stream)))]
      const [aliasResult, subjectResult] = await Promise.all([
        requestedGroups.length ? admin.from('subject_catalog_aliases').select('alias_key,subject_id,group_code').in('alias_key', requestedAliases).in('group_code', requestedGroups) : Promise.resolve({ data: [], error: null }),
        admin.from('subject_catalog').select('id,is_active'),
      ])
      if (aliasResult.error) throw aliasResult.error
      if (subjectResult.error) throw subjectResult.error
      const activeSubjectIds = new Set((subjectResult.data ?? []).filter(subject => subject.is_active).map(subject => subject.id))
      for (const assignment of classSubjectAssignments) {
        const groups = curriculumGroupsForAssignment(campus, assignment.class_level, assignment.class_stream)
        const aliasKey = normalizeSubjectLabel(assignment.subject)
        const matches = (aliasResult.data ?? []).filter(alias => alias.alias_key === aliasKey && groups.includes(alias.group_code) && activeSubjectIds.has(alias.subject_id))
        let resolvedIds = [...new Set(matches.map(alias => alias.subject_id))]
        if (groups.length > 1 && !assignment.class_stream) {
          const coveredGroups = new Set(matches.map(alias => alias.group_code))
          if (groups.some(group => !coveredGroups.has(group))) resolvedIds = []
        }
        if (resolvedIds.length > 1) throw new Error(`The subject “${assignment.subject}” is ambiguous in ${assignment.class_level}; choose a specific pathway.`)
        const resolvedId = resolvedIds[0] ?? null
        if (assignment.subject_id && assignment.subject_id !== resolvedId) throw new Error(`The selected subject is no longer available in ${assignment.class_level}. Refresh the catalog and choose it again.`)
        assignment.subject_id = resolvedId
      }
    }
    const duplicateSubjectAllocation = new Set<string>()
    for (const assignment of classSubjectAssignments) {
      const key = `${assignment.subject_id || normalizeSubjectLabel(assignment.subject)}|${assignment.class_level}|${assignment.class_stream}`
      if (duplicateSubjectAllocation.has(key)) throw new Error('A subject can be allocated only once to the same class.')
      duplicateSubjectAllocation.add(key)
    }
    if (target.role === 'teacher') await ensureSubjectSlotsAreAvailable(admin, campus, classSubjectAssignments, userId)

    const primaryAssignment = classAssignments[0]
    const primaryClass = primaryAssignment?.class_level ?? null
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        full_name: fullName,
        legal_full_name: legalFullName || null,
        working_title: legalFullName ? workingTitle : null,
        campus,
        class_level: target.role === 'teacher' ? primaryClass : null,
        class_stream: target.role === 'teacher' ? (primaryAssignment?.class_stream || null) : null,
      })
      .eq('id', userId)
    if (profileError) throw profileError

    const { error: accountError } = await admin
      .from('staff_accounts')
      .update({ name: fullName, campus, class_assigned: target.role === 'teacher' ? classAssignments.map((assignment) => `${assignment.class_level}${assignment.class_stream ? ` ${assignment.class_stream}` : ''}`).join(', ') || null : null })
      .eq('user_id', userId)
    if (accountError) throw accountError

    if (target.role === 'teacher') {
      const { error: removeAssignmentsError } = await admin
        .from('teacher_class_assignments')
        .delete()
        .eq('teacher_id', userId)
      if (removeAssignmentsError) throw removeAssignmentsError
      if (classAssignments.length) {
        const { error: assignmentsError } = await admin
          .from('teacher_class_assignments')
          .insert(classAssignments.map((assignment) => ({
            teacher_id: userId,
            class_level: assignment.class_level,
            // The assignment table's legacy column is NOT NULL; Junior uses an empty stream.
            class_stream: assignment.class_stream,
            campus,
          })))
        if (assignmentsError) throw assignmentsError
      }

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
            subject_id: assignment.subject_id,
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
