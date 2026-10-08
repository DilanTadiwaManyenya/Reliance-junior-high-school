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
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user } } = await admin.auth.getUser(token)
    if (!user) throw new Error('Authentication is required.')

    const { data: caller } = await admin
      .from('profiles')
      .select('role, active_role, campus')
      .eq('id', user.id)
      .single()
    if (caller?.role !== 'admin' || caller?.active_role !== 'admin' || caller?.campus !== 'all') {
      throw new Error('Only the Main Admin can remove staff accounts.')
    }

    const { user_id: userId } = await request.json()
    if (!userId || userId === user.id) throw new Error('The Main Admin account cannot be removed here.')

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id, full_name, is_protected')
      .eq('id', String(userId))
      .single()
    if (targetError || !target) throw new Error('Staff account not found.')
    if (target.is_protected) throw new Error('This protected account cannot be removed here.')

    // Historical entries point to profiles. Deleting Auth would cascade the
    // profile and fail against those records, or erase their attribution. We
    // instead revoke the account completely and retain the historical identity.
    const { error: assignmentError } = await admin
      .from('teacher_class_assignments')
      .delete()
      .eq('teacher_id', String(userId))
    if (assignmentError) throw assignmentError

    const { error: roleError } = await admin
      .from('user_roles')
      .delete()
      .eq('user_id', String(userId))
    if (roleError) throw roleError

    const { error: staffAccountError } = await admin
      .from('staff_accounts')
      .delete()
      .eq('user_id', String(userId))
    if (staffAccountError) throw staffAccountError

    const { error: profileError } = await admin
      .from('profiles')
      .update({ portal_access_enabled: false, class_level: null, class_stream: null })
      .eq('id', String(userId))
    if (profileError) throw profileError

    const { error: authError } = await admin.auth.admin.updateUserById(String(userId), {
      ban_duration: '876000h',
    })
    if (authError) throw authError

    return reply({
      success: true,
      message: `${target.full_name || 'Staff member'} has been removed from portal access. Historical school records were retained.`,
    })
  } catch (error) {
    return reply({ success: false, error: error instanceof Error ? error.message : 'Unable to remove staff account.' }, 400)
  }
})
