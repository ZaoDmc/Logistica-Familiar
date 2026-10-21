import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';

export function localSecrets(filename) {
  const url = new URL(`../${filename}`, import.meta.url);
  return existsSync(url) ? parseEnv(readFileSync(url, 'utf8')) : {};
}
export function projectConfig() {
  const env = loadEnv('development', process.cwd(), 'VITE_');
  const url = env.VITE_SUPABASE_URL;
  const ref = new URL(url).hostname.split('.')[0];
  if (!/^[a-z0-9]+$/.test(ref) || !url.endsWith('.supabase.co')) throw new Error('Configuración de proyecto inválida');
  return { ref, url, publicKey: env.VITE_SUPABASE_PUBLISHABLE_KEY };
}
export async function management(path, options = {}) {
  const token = process.env.SUPABASE_ACCESS_TOKEN || localSecrets('.env.supabase.local').SUPABASE_ACCESS_TOKEN;
  if (!token) throw Object.assign(new Error('Falta SUPABASE_ACCESS_TOKEN en .env.supabase.local'), { code: 'MISSING_MANAGEMENT_TOKEN' });
  const response = await fetch(`https://api.supabase.com/v1${path}`, {
    ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers }, signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    // El cuerpo nunca se imprime: puede incluir parámetros sensibles.
    throw Object.assign(new Error('Management API rechazó la operación'), { code: `MANAGEMENT_HTTP_${response.status}`, detail: body });
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
export async function adminClient() {
  const config = projectConfig();
  const keys = await management(`/projects/${config.ref}/api-keys?reveal=true`);
  const key = keys.find(item => item.name === 'service_role' || item.type === 'secret');
  const secret = key?.api_key || key?.key;
  if (!secret) throw Object.assign(new Error('No hay clave administrativa disponible'), { code: 'NO_ADMIN_KEY' });
  return createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
