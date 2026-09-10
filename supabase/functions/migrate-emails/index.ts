import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const normalizePhone = (raw: unknown) => {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}
const buildPortalEmail = (phone: unknown) =>
  `portal-${normalizePhone(phone).replace(/^\+/, '')}@portal.reliance.local`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Use POST to run this one-time migration.' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) throw new Error('Authentication is required.')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Do not leave a service-role migration endpoint publicly callable.
    const token = authorization.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) throw new Error('Authentication is required.')

    const { data: caller, error: callerError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (callerError) throw callerError
    if (String(caller?.role ?? '').toLowerCase() !== 'admin') {
      throw new Error('Only administrators can run this migration.')
    }

    const changed: Array<{ id: string; oldEmail: string | null; newEmail: string }> = []
    let checked = 0
    const pageSize = 1000

    for (let from = 0; ; from += pageSize) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, phone')
        .not('phone', 'is', null)
        .order('id')
        .range(from, from + pageSize - 1)

      if (profilesError) throw profilesError
      if (!profiles?.length) break

      for (const profile of profiles) {
        checked += 1
        const newEmail = buildPortalEmail(profile.phone)
        const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(profile.id)
        if (userError) throw userError

        const oldEmail = userResult.user.email ?? null
        if (oldEmail?.toLowerCase() === newEmail.toLowerCase()) continue

        const { error: updateError } = await supabase.auth.admin.updateUserById(profile.id, { email: newEmail })
        if (updateError) throw updateError
        changed.push({ id: profile.id, oldEmail, newEmail })
      }

      if (profiles.length < pageSize) break
    }

    return json({ checked, updated: changed.length, changed })
  } catch (error) {
    console.error(error)
    return json(
      { error: error instanceof Error ? error.message : 'Email migration failed.' },
      400,
    )
  }
})
