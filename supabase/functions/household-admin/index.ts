import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createHouseholdHandler } from '../_shared/household-handler.mjs';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const origins = (Deno.env.get('APP_ORIGINS') || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map(value => value.trim()).filter(Boolean);
Deno.serve(createHouseholdHandler({ admin, origins }));
