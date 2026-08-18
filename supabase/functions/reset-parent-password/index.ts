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
    const { data: admin } = await serviceClient.from('profiles').select('role').eq('id', user.id).single()
    if (admin?.role !== 'admin') throw new Error('Only administrators can reset parent passwords.')

    const { targetUserId, newPassword } = await request.json()
    if (!targetUserId) throw new Error('Select a parent account.')
    if (!newPassword || newPassword.length < 8) throw new Error('The new password must be at least 8 characters.')
    const { data: parent, error: parentError } = await serviceClient.from('profiles').select('id').eq('id', targetUserId).eq('role', 'parent').maybeSingle()
    if (parentError || !parent) throw new Error('The selected account is not a parent account.')
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(targetUserId, { password: newPassword })
    if (updateError) throw updateError
    return Response.json({ message: 'Parent password reset successfully.' }, { headers: corsHeaders })
  } catch (error) {
    console.error(error)
    return Response.json({ error: error && typeof error === 'object' && 'message' in error ? error.message : 'Password reset failed.' }, { status: 400, headers: corsHeaders })
  }
})
