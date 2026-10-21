import { readFileSync } from 'node:fs';
import { localSecrets, management, projectConfig } from './supabase-management.mjs';
import { reportDatabaseError } from './database-connection.mjs';

let step = 'configuración';
try {
  const { ref } = projectConfig();
  const env = localSecrets('.env.supabase.local');
  const origins = (env.APP_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(value => new URL(value.trim()).origin);
  if (!origins.every(origin => origin.startsWith('https://') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) throw Object.assign(new Error(), { code: 'INVALID_APP_ORIGIN' });
  await management(`/projects/${ref}/config/auth`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ disable_signup: true, external_email_enabled: true, site_url: origins[0], uri_allow_list: origins.join(','), mailer_otp_exp: 3600 }),
  });
  step = 'orígenes permitidos';
  await management(`/projects/${ref}/secrets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ name: 'APP_ORIGINS', value: origins.join(',') }]) });
  const data = new FormData();
  data.append('metadata', JSON.stringify({ name: 'household-admin', entrypoint_path: 'household-admin/index.ts', verify_jwt: false }));
  for (const path of ['household-admin/index.ts', '_shared/household-handler.mjs']) {
    data.append('file', new Blob([readFileSync(new URL(`../supabase/functions/${path}`, import.meta.url), 'utf8')], { type: 'application/typescript' }), path);
  }
  step = 'despliegue';
  const result = await management(`/projects/${ref}/functions/deploy?slug=household-admin`, { method: 'POST', body: data });
  console.log(`Función household-admin: ${result.status || 'desplegada'}. Registro público deshabilitado; acceso por invitación.`);
} catch (error) {
  console.error(`Paso pendiente: ${step}.`);
  if (step === 'despliegue' && error.detail?.message) console.error(String(error.detail.message).replace(/sbp_[A-Za-z0-9]+/g, '[privado]').slice(0, 500));
  reportDatabaseError(error);
}
