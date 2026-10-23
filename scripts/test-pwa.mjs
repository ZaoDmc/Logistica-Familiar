import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import vm from 'node:vm';

const origin = 'https://household.example', files = new Map(), handlers = new Map(), stores = new Map();
const worker = readFileSync('dist/sw.js','utf8');
let passed = 0, failNetwork = false, claims = 0, activated = 0, requests = [];
const check = (condition, label) => { assert.ok(condition, label); passed++; };
function collect(directory, prefix = '') {
  for (const entry of readdirSync(directory,{withFileTypes:true})) {
    const path = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) collect(`${directory}/${entry.name}`,path);
    else files.set(new URL(path, origin).href, readFileSync(`${directory}/${entry.name}`));
  }
}
collect('dist');
const key = value => new URL(typeof value === 'string' ? value : value.url,origin).href;
const caches = {
  keys: async () => [...stores.keys()], delete: async name => stores.delete(name),
  open: async name => {
    if (!stores.has(name)) stores.set(name,new Map());
    const store = stores.get(name);
    return { addAll: async entries => { for (const request of entries) { check(files.has(key(request)), 'Precaché apunta a archivo real'); check(request.credentials === 'omit','Precaché sin credenciales'); store.set(key(request),new Response(files.get(key(request)))); } },
      match: async request => store.get(key(request))?.clone() };
  },
};
vm.runInNewContext(worker,{URL,Request,Response,Set,caches,
  fetch: async request => { requests.push(request); if(failNetwork)throw new Error('offline'); return new Response('respuesta de red'); },
  self:{location:{origin},clients:{claim:async () => {claims++;}},skipWaiting:async () => {activated++;},addEventListener:(event,handler) => handlers.set(event,handler)},
});
const life = async (name, extras = {}) => { let pending; handlers.get(name)({...extras,waitUntil:promise => {pending=promise;}}); await pending; };
async function request(url, options = {}) {
  let result;
  handlers.get('fetch')({request:{url: key(url),method:'GET',mode:'cors',...options},respondWith:promise => {result=promise;}});
  return result;
}
await life('install'); check(activated === 0, 'Una actualización no fuerza activación al instalar');
const cacheName = [...stores.keys()][0];
check([...stores.get(cacheName).keys()].every(url => !new URL(url).pathname.endsWith('/index.html') && new URL(url).pathname !== '/'),'HTML de sesión no se almacena');
check(await request('https://project.supabase.co/auth/v1/token') === undefined, 'Auth externo no se intercepta');
check(await request('https://project.supabase.co/rest/v1/products') === undefined, 'Inventario externo no se intercepta');
check(await request('/api/private') === undefined, 'API propia no se intercepta');
check(await request('/icons/logan-192.png',{method:'POST'}) === undefined, 'POST nunca se intercepta');
check(await request('/icons/logan-192.png?token=private') === undefined, 'URLs con parámetros no entran en caché pública');
const icon = await request('/icons/logan-192.png'); check((await icon.arrayBuffer()).byteLength > 100,'Icono público disponible');
// Request real de navegación para el constructor del trabajador.
async function navigation() {
  const nav = new Request(origin + '/?private=example');
  Object.defineProperty(nav,'mode',{value:'navigate'});
  let response; handlers.get('fetch')({request:nav,respondWith:value => {response=value;}}); return response;
}
check(await (await navigation()).text() === 'respuesta de red','Navegación consulta la red');
check(requests.at(-1).cache === 'no-store','Navegación sin caché HTTP');
check(![...stores.get(cacheName).keys()].some(value => value.includes('private=')),'No guardar parámetros de navegación');
failNetwork = true;
const logan = await request('/icons/Logitan%20Bello.png');
check(Buffer.from(await logan.arrayBuffer()).equals(readFileSync('public/icons/Logitan Bello.png')), 'Foto original de Logan disponible sin red, incluso con espacios en la URL');
check((await (await navigation()).text()).includes('Tu hogar te espera.'),'Sin red entrega página pública sin datos del hogar');
stores.set('lf-public-old',new Map()); stores.set('unrelated-cache',new Map());
await life('activate'); check(claims === 1,'Activación toma control');
check(!stores.has('lf-public-old') && stores.has('unrelated-cache'),'Limpiar solo cachés públicas propias antiguas');
await life('message',{data:{type:'OTHER'}}); check(activated === 0,'Otros mensajes no activan');
await life('message',{data:{type:'ACTIVATE_UPDATE'}}); check(activated === 1,'Activación solicitada explícitamente');
const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest','utf8'));
check(manifest.display === 'standalone' && manifest.start_url === '/' && manifest.id === '/', 'Identidad y apertura instalable');
for (const item of manifest.icons) {
  const png = files.get(origin + item.src), [width,height] = item.sizes.split('x').map(Number);
  check(png?.readUInt32BE(16) === width && png.readUInt32BE(20) === height, 'Dimensiones PNG reales coinciden con manifest');
}
check(manifest.icons.some(item => item.purpose === 'maskable'), 'Icono adaptable disponible');
const config = JSON.parse(readFileSync('vercel.json','utf8'));
check(config.headers.some(rule => rule.source === '/sw.js' && rule.headers.some(header => header.key === 'Cache-Control' && header.value === 'no-cache')), 'Vercel permite revisar versiones nuevas');
// Buscar nombres y firmas de credenciales privilegiadas sin imprimir su contenido.
const application = [...files.entries()].filter(([url]) => /\.(js|html|json|webmanifest|css)$/.test(url));
check(application.every(([,bytes]) => !/sbp_[A-Za-z0-9]+|sb_secret_[A-Za-z0-9]+|SUPABASE_ACCESS_TOKEN|ADMIN_PASSWORD|DATABASE_URL/.test(bytes.toString())), 'Bundle no contiene firmas de secretos administrativos');
const jwtTokens = application.flatMap(([,bytes]) => bytes.toString().match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []);
check(jwtTokens.every(token => { try { return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).role !== 'service_role'; } catch { return false; } }), 'Sin JWT de service_role en archivos publicados');
const secrets = [];
for (const [file, keys] of [['.env.admin.local',['ADMIN_PASSWORD']],['.env.supabase.local',['SUPABASE_ACCESS_TOKEN']],['.env.vercel.local',['VERCEL_TOKEN']]]) {
  if (existsSync(file)) { const env = parseEnv(readFileSync(file,'utf8')); for (const name of keys) if (env[name]?.length >= 10) secrets.push(env[name]); }
}
if (existsSync('pass.txt')) { const password = readFileSync('pass.txt','utf8').trim(); if (password.length >= 10) secrets.push(password); }
check(application.every(([,bytes]) => secrets.every(secret => !bytes.toString().includes(secret))), 'Ninguna credencial privada local aparece en el bundle');
console.log(`PWA: ${passed} comprobaciones correctas de caché, permisos, actualización, manifest e iconos.`);
