import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { management, projectConfig } from './supabase-management.mjs';
const origin = process.argv[2];
if (!origin || new URL(origin).protocol !== 'https:' || new URL(origin).origin !== origin) throw new Error('EXPECTED_HTTPS_ORIGIN');
let passed = 0;
const check = (condition,label) => { assert.ok(condition,label); passed++; };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function visit(directory, prefix='') {
  for (const entry of readdirSync(directory,{withFileTypes:true})) {
    const path = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) { await visit(`${directory}/${entry.name}`,path); continue; }
    const response = await fetch(origin + path,{cache:'no-store',signal:AbortSignal.timeout(20000)});
    check(response.status === 200,`${path}: HTTP 200`);
    check(digest(Buffer.from(await response.arrayBuffer())) === digest(readFileSync(`${directory}/${entry.name}`)),`${path}: idéntico al artefacto validado`);
    if (path === '/index.html') {
      check(response.headers.get('cache-control')?.includes('no-store'),'HTML no se conserva en caché HTTP');
      check(response.headers.get('x-content-type-options') === 'nosniff','Tipos de contenido sin sniffing');
      check(response.headers.get('x-frame-options') === 'DENY','La aplicación no se abre dentro de marcos ajenos');
    }
    if (path === '/sw.js') check(response.headers.get('cache-control')?.includes('no-cache'),'Trabajador revisa actualizaciones');
    if (path.startsWith('/assets/')) check(response.headers.get('cache-control')?.includes('immutable'),'Assets versionados inmutables');
    check(response.headers.get('referrer-policy') === 'no-referrer',`${path}: enlaces de invitación sin Referer`);
  }
}
try {
  await visit('dist');
  const {url,ref} = projectConfig();
  const auth = await management(`/projects/${ref}/config/auth`);
  check(auth.site_url === origin && auth.uri_allow_list.split(',').includes(origin),'Auth acepta la dirección publicada');
  check(auth.disable_signup === true,'Registro público permanece cerrado');
  const preflight = await fetch(`${url}/functions/v1/household-admin`,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type'},signal:AbortSignal.timeout(20000)});
  check(preflight.ok && preflight.headers.get('access-control-allow-origin') === origin,'Función administrativa acepta el origen HTTPS exacto');
  const denied = await fetch(`${url}/functions/v1/household-admin`,{method:'OPTIONS',headers:{Origin:'https://unrelated.example','Access-Control-Request-Method':'POST'},signal:AbortSignal.timeout(20000)});
  check(!denied.headers.get('access-control-allow-origin'),'Otro origen no obtiene permiso CORS');
  console.log(`Publicación HTTPS: ${passed} comprobaciones correctas de integridad, cabeceras, Auth y CORS.`);
} catch(error) { console.error(`Verificación de publicación fallida (${error.code || error.name}).`); if(error.code === 'ERR_ASSERTION') console.error(error.message); process.exitCode=1; }
