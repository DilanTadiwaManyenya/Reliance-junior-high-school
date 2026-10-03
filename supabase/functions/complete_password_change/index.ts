import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers })

// This function deliberately changes only the authenticated person's profile.
// The password itself is changed by Supabase Auth in the browser immediately
// before this call; service-role access is needed because clients cannot update
// credential-control columns on profiles directly.
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return reply({ success: false, error: 'method_not_allowed' }, 405)
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) throw new Error('Authentication is required.')

    const { error } = await admin
      .from('profiles')
      .update({ must_change_password: false, must_update_credentials: false })
      .eq('id', user.id)
    if (error) throw error
    return reply({ success: true })
  } catch (error) {
    return reply({ success: false, error: error instanceof Error ? error.message : 'Unable to complete password change.' }, 400)
  }
})
