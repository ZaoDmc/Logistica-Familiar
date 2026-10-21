import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export async function householdAction<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('La conexión de la aplicación está pendiente.');
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${url}/functions/v1/household-admin`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key,
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No pudimos completar la operación. Intenta nuevamente.');
  return result as T;
}
