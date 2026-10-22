import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export function vercelConfig() {
  const path = new URL('../.env.vercel.local', import.meta.url);
  const local = existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
  const token = process.env.VERCEL_TOKEN || local.VERCEL_TOKEN;
  if (!token || /pega_aqui|tu_token/.test(token)) throw new Error('MISSING_VERCEL_TOKEN');
  if (/^sb(p_|_secret_|_publishable_)/.test(token)) throw new Error('WRONG_PROVIDER_TOKEN: el archivo contiene una clave de Supabase, no de Vercel');
  return { token, teamId: process.env.VERCEL_TEAM_ID || local.VERCEL_TEAM_ID };
}
export async function vercel(path, options = {}) {
  const { token, teamId } = vercelConfig();
  const url = new URL(path, 'https://api.vercel.com');
  if (url.origin !== 'https://api.vercel.com') throw new Error('INVALID_VERCEL_ENDPOINT');
  if (teamId) url.searchParams.set('teamId', teamId);
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(45000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`VERCEL_HTTP_${response.status}`), { code: result.error?.code || 'UNKNOWN', hint: String(result.error?.message || '').replaceAll(token,'[privado]').slice(0,300) });
  return result;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/vercel-api.mjs')) {
  try {
    const projects = await vercel('/v9/projects?limit=100');
    console.log('Acceso Vercel correcto. Proyectos visibles:');
    console.log(JSON.stringify((projects.projects || []).map(project => ({id:project.id,name:project.name,framework:project.framework,repository:project.link?.repo,productionBranch:project.link?.productionBranch})),null,2));
  } catch (error) { console.error(`${error.message} (${error.code || 'configuración'}). No se muestra el token.`); if (error.hint) console.error(error.hint); process.exitCode = 1; }
}
