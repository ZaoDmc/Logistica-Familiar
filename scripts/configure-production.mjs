import { readFileSync, writeFileSync } from 'node:fs';
import { localSecrets, management, projectConfig } from './supabase-management.mjs';

try {
  const input = process.argv[2];
  if (!input) throw new Error('EXPECTED_HTTPS_ORIGIN_ARGUMENT');
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.port) throw new Error('EXPECTED_EXACT_HTTPS_ORIGIN');
  const env = localSecrets('.env.supabase.local'), {ref} = projectConfig();
  const local = (env.APP_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(value => value.trim()).filter(Boolean);
  const origins = [...new Set([url.origin,...local])];
  const previous = await management(`/projects/${ref}/config/auth`);
  const redirects = [...new Set([...(previous.uri_allow_list || '').split(',').filter(Boolean),...origins])];
  await management(`/projects/${ref}/config/auth`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({site_url:url.origin,uri_allow_list:redirects.join(',')})});
  await management(`/projects/${ref}/secrets`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify([{name:'APP_ORIGINS',value:origins.join(',')}])});
  // Mantener producción al volver a desplegar la función con auth:deploy.
  const path = new URL('../.env.supabase.local',import.meta.url);
  const source = readFileSync(path,'utf8');
  writeFileSync(path,/^APP_ORIGINS\s*=.*$/m.test(source) ? source.replace(/^APP_ORIGINS\s*=.*$/m,`APP_ORIGINS=${origins.join(',')}`) : `${source.trimEnd()}\nAPP_ORIGINS=${origins.join(',')}\n`);
  const verified = await management(`/projects/${ref}/config/auth`);
  if (verified.site_url !== url.origin || !verified.uri_allow_list?.split(',').includes(url.origin)) throw new Error('AUTH_ORIGIN_NOT_CONFIRMED');
  console.log(`Supabase configurado para ${url.origin}. Orígenes locales conservados; registro público sin cambios.`);
} catch(error) { console.error(`Configuración pendiente: ${error.message} (${error.code || 'operación'}).`); process.exitCode=1; }
