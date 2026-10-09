import { build } from '../backend/node_modules/esbuild/lib/main.js';
import { mkdir, copyFile, cp, writeFile, readdir, readFile, rm, lstat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'release');
if (path.relative(root, output) !== 'release') throw Error('Directorio de artefactos inválido');
try { if ((await lstat(output)).isSymbolicLink()) throw Error('release no debe ser un enlace simbólico'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
execFileSync(process.platform==='win32'?'cmd.exe':'npm',process.platform==='win32'?['/d','/s','/c','npm run build']:['run','build'],{cwd:path.join(root,'frontend'),stdio:'inherit'});
await rm(output, { recursive: true, force: true });
for (const name of ['backend','frontend','database']) await mkdir(path.join(output,name,'deploy'),{recursive:true});
for (const [entry, outfile] of [['backend/server.js','backend/dist/server.js'],['backend/scripts/bootstrapSuperAdmin.js','backend/dist/seed-superadmin.js']]) {
  await build({absWorkingDir:root,entryPoints:[entry],outfile:path.join(output,outfile),bundle:true,platform:'node',target:'node24',packages:'external',minify:true,sourcemap:false});
}
const pkg=JSON.parse(await readFile(path.join(root,'backend/package.json'),'utf8'));
await writeFile(path.join(output,'backend/package.json'),JSON.stringify({name:'aws-api',version:'1.0.0',private:true,scripts:{start:'node --require ./deploy/runtime.cjs dist/server.js', 'seed:superadmin':'node --require ./deploy/runtime.cjs dist/seed-superadmin.js'},dependencies:pkg.dependencies},null,2));
// Preserve the exact runtime dependency versions already tested in the source lockfile.
const lock=JSON.parse(await readFile(path.join(root,'backend/package-lock.json'),'utf8'));
lock.name='aws-api';lock.version='1.0.0';
lock.packages['']={name:'aws-api',version:'1.0.0',dependencies:pkg.dependencies};
for(const [name,info] of Object.entries(lock.packages))if(info.dev)delete lock.packages[name];
await writeFile(path.join(output,'backend/package-lock.json'),JSON.stringify(lock,null,2));
await cp(path.join(root,'frontend/dist'),path.join(output,'frontend/dist'),{recursive:true});
for(const [name,files] of Object.entries({backend:['common.sh','deploy-back.sh','runtime.cjs'],frontend:['common.sh','deploy-front.sh','nginx.conf.template','enable-https.sh'],database:['common.sh','deploy-db.sh','backup-db.sh']})){
  for(const f of files)await copyFile(path.join(root,'deploy',f),path.join(output,name,'deploy',f));
  await writeFile(path.join(output,name,'.gitignore'),'node_modules/\n.env\n.env.*\nruntime-env.json\nbackups/\n*.log\n');
}
await writeFile(path.join(output,'database/deploy/schema.sql'),await readFile(path.join(root,'backend/src/infrastructure/database/schema.sql'),'utf8')+'\n'+await readFile(path.join(root,'backend/src/infrastructure/database/commerce.sql'),'utf8'));
async function scan(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await scan(p);else if(/\.(js|html|css)$/.test(f.name)&&/localhost|127\.0\.0\.1|VITE_API_URL/.test(await readFile(p,'utf8')))throw Error('Referencia local en frontend: '+p);}}
await scan(path.join(output,'frontend/dist'));
console.log('Artefactos listos en release/backend, release/frontend y release/database');
