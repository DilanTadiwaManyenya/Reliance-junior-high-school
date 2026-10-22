import { requireAdminMfa } from '../_shared/adminMfa.js'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const authorization = request.headers.get('Authorization')
    if (!authorization) throw new Error('Authentication is required.')
    const serviceClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(authorization.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Authentication is required.')
    const { data: actor, error: actorError } = await serviceClient.from('profiles').select('role,active_role,campus').eq('id', user.id).single()
    if (actorError || !actor) throw new Error('Your portal role could not be verified.')
    const isAdmin = actor.role === 'admin' && actor.active_role === 'admin' && ['all', 'junior', 'senior'].includes(actor.campus)
    let actorCampus = actor.campus
    if (actor.role === 'accountant' && actor.active_role === 'accountant') {
      const { data: assignment, error: assignmentError } = await serviceClient.from('staff_accounts').select('campus').eq('user_id', user.id).maybeSingle()
      if (assignmentError) throw assignmentError
      actorCampus = assignment?.campus || actorCampus
    }
    const isAccountant = actor.role === 'accountant' && actor.active_role === 'accountant' && ['junior', 'senior'].includes(actorCampus)
    if (!isAdmin && !isAccountant) throw new Error('Only administrators and assigned campus accountants can reset parent passwords.')

    await requireAdminMfa(serviceClient, authorization.replace(/^Bearer\s+/i, ''))
    const { targetUserId, newPassword } = await request.json()
    if (!targetUserId) throw new Error('Select a parent account.')
    if (!newPassword || newPassword.length < 8) throw new Error('The new password must be at least 8 characters.')
    const { data: parent, error: parentError } = await serviceClient.from('profiles').select('id').eq('id', targetUserId).eq('role', 'parent').maybeSingle()
    if (parentError || !parent) throw new Error('The selected account is not a parent account.')
    const { data: parentAccount, error: accountError } = await serviceClient.from('parent_accounts').select('child_admission_number').eq('user_id', targetUserId).maybeSingle()
    if (accountError || !parentAccount) throw new Error('The selected parent account could not be found.')
    if (actorCampus !== 'all') {
      const { data: links, error: linksError } = await serviceClient.from('parent_student').select('student_id').eq('parent_id', targetUserId)
      if (linksError || !links?.length) throw new Error('This parent account has no verified learner link for your campus.')
      const { data: linkedStudents, error: studentsError } = await serviceClient.from('students').select('campus').in('id', links.map(link => link.student_id))
      if (studentsError || !linkedStudents?.some(student => student.campus === actorCampus)) throw new Error('This parent account is outside your assigned campus.')
    }
    const { error: flagError } = await serviceClient.from('profiles').update({ must_change_password: true }).eq('id', targetUserId)
    if (flagError) throw flagError
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(targetUserId, { password: newPassword })
    if (updateError) {
      await serviceClient.from('profiles').update({ must_change_password: false }).eq('id', targetUserId)
      throw updateError
    }
    return Response.json({ message: 'Parent password reset. They will be asked to choose a new password at sign-in.' }, { headers: corsHeaders })
  } catch (error) {
    console.error(error)
    return Response.json({ error: error && typeof error === 'object' && 'message' in error ? error.message : 'Password reset failed.' }, { status: 400, headers: corsHeaders })
  }
})
