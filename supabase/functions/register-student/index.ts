import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { registerStudentHandler } from '../_shared/registerStudent.js'
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
Deno.serve(registerStudentHandler(admin, code => console.error(code)))
