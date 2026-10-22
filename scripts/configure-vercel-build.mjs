import { readFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { vercel } from './vercel-api.mjs';
try {
  const project = JSON.parse(readFileSync(new URL('../.vercel/project.json',import.meta.url),'utf8'));
  process.env.VERCEL_TEAM_ID ||= project.orgId;
  const env = loadEnv('production',process.cwd(),'VITE_');
  const names = ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (names.some(name => !env[name])) throw new Error('MISSING_PUBLIC_BUILD_VARIABLES');
  await vercel(`/v10/projects/${project.projectId}/env?upsert=true`,{method:'POST',body:JSON.stringify(names.map(key => ({key,value:env[key],type:'plain',target:['production','preview','development']})))});
  await vercel(`/v9/projects/${project.projectId}`,{method:'PATCH',body:JSON.stringify({framework:'vite',buildCommand:'npm run build',installCommand:'npm ci',outputDirectory:'dist',nodeVersion:'24.x'})});
  const result = await vercel(`/v9/projects/${project.projectId}`);
  if (result.framework !== 'vite' || result.buildCommand !== 'npm run build' || result.outputDirectory !== 'dist') throw new Error('BUILD_SETTINGS_NOT_CONFIRMED');
  const variables = await vercel(`/v9/projects/${project.projectId}/env`);
  if (!names.every(key => variables.envs?.some(item => item.key === key && ['production','preview','development'].every(target => item.target?.includes(target))))) throw new Error('BUILD_VARIABLES_NOT_CONFIRMED');
  console.log('Vercel preparado para compilar desde GitHub: Vite, Node 24, npm ci, npm run build y dist. Solo se copiaron las dos variables públicas.');
  console.log(`Repositorio conectado: ${result.link?.repo || 'pendiente de vincular en Settings → Git'}.`);
} catch(error) { console.error(`Configuración Vercel pendiente: ${error.message} (${error.code || 'operación'}).`); if(error.hint)console.error(error.hint); process.exitCode=1; }
