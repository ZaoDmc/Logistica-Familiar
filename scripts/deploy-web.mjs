import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { vercel, vercelConfig } from './vercel-api.mjs';

const stateFile = new URL('../.vercel/deployment.json', import.meta.url);
const projectFile = new URL('../.vercel/project.json', import.meta.url);
const load = path => existsSync(path) ? JSON.parse(readFileSync(path,'utf8')) : null;
const save = (path,value) => { mkdirSync(new URL('../.vercel/',import.meta.url),{recursive:true}); writeFileSync(path,JSON.stringify(value,null,2)); };
try {
  const savedProject = load(projectFile);
  if (!vercelConfig().teamId && savedProject?.orgId) process.env.VERCEL_TEAM_ID = savedProject.orgId;
  if (!vercelConfig().teamId) {
    const {teams} = await vercel('/v2/teams');
    if (teams?.length !== 1) throw new Error('SELECT_VERCEL_TEAM_ID_IN_PRIVATE_ENV');
    if (teams[0].billing?.plan !== 'hobby') throw new Error('EXPECTED_HOBBY_TEAM');
    process.env.VERCEL_TEAM_ID = teams[0].id;
  }
  if (process.argv[2] === 'status') {
    const previous = load(stateFile);
    if (!previous?.id) throw new Error('NO_DEPLOYMENT_TO_CHECK');
    const result = await vercel(`/v13/deployments/${previous.id}`);
    const record = {...previous,state:result.readyState,url:`https://${result.url}`,aliases:result.alias || []};
    save(stateFile,record); console.log(JSON.stringify(record,null,2));
    if (['ERROR','CANCELED'].includes(result.readyState)) process.exitCode = 1;
  } else {
    // Verifica el artefacto exacto que se subirá; nunca se envían fuentes privadas ni .env.
    execFileSync(process.execPath,['scripts/test-pwa.mjs'],{stdio:'inherit'});
    const files = [];
    function collect(directory, prefix='') {
      for (const entry of readdirSync(directory,{withFileTypes:true})) {
        if (entry.isSymbolicLink()) throw new Error('UNEXPECTED_BUILD_SYMLINK');
        const file = prefix + entry.name;
        if (entry.isDirectory()) collect(`${directory}/${entry.name}`,`${file}/`);
        else files.push({file,data:readFileSync(`${directory}/${entry.name}`).toString('base64'),encoding:'base64'});
      }
    }
    collect('dist');
    if (files.some(({file}) => /(^|\/)(\.|pass\.txt)/.test(file))) throw new Error('UNEXPECTED_PRIVATE_FILE_IN_DIST');
    const headers = JSON.parse(readFileSync('vercel.json','utf8')).headers;
    // El proyecto puede tener npm ci / Vite configurados para Git. Este artefacto
    // ya está compilado: su configuración debe prevalecer sobre esos ajustes.
    const staticSettings = {framework:null,buildCommand:'',installCommand:'',outputDirectory:'.'};
    files.push({file:'vercel.json',data:JSON.stringify({version:2,...staticSettings,headers}),encoding:'utf-8'});
    const buildId = createHash('sha256').update(JSON.stringify(files)).digest('hex');
    let project;
    if (savedProject) project = await vercel(`/v9/projects/${savedProject.projectId}`);
    else {
      const {projects} = await vercel('/v9/projects?limit=100');
      project = projects.find(item => item.name === 'logistica-familiar');
      if (project && !(project.link?.repo === 'Logistica-Familiar' && project.link?.org === 'ZaoDmc')) throw new Error('EXISTING_PROJECT_REQUIRES_EXPLICIT_LINK');
      if (!project) project = await vercel('/v11/projects',{method:'POST',body:JSON.stringify({name:'logistica-familiar',framework:null})});
      save(projectFile,{projectId:project.id,orgId:vercelConfig().teamId,projectName:project.name});
    }
    // Recuperar un despliegue previo si se perdió la respuesta al crearlo.
    const {deployments} = await vercel(`/v6/deployments?projectId=${project.id}&limit=20`);
    let result = deployments?.find(item => item.meta?.lfBuildId === buildId && !['ERROR','CANCELED'].includes(item.state));
    if (!result) result = await vercel('/v13/deployments',{method:'POST',body:JSON.stringify({
      name:project.name,project:project.id,target:'production',files,
      projectSettings:staticSettings,
      meta:{lfBuildId:buildId,lfSourceBranch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim()},
    })});
    const record = {id:result.id || result.uid,projectId:project.id,buildId,state:result.readyState || result.state,url:`https://${result.url}`,aliases:result.alias || []};
    save(stateFile,record); console.log(JSON.stringify(record,null,2));
  }
} catch(error) { console.error(`Publicación pendiente: ${error.message} (${error.code || 'operación'}).`); if (error.hint) console.error(error.hint); process.exitCode=1; }
