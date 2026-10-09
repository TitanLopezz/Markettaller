const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {Client}=require('pg');
require('dotenv').config({path:path.join(__dirname,'../.env')});
async function run(){
 const env=process.env;
 const dumpBinary=env.PG_DUMP_BIN||(process.platform==='win32'?'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe':'pg_dump');
 let sql=execFileSync(dumpBinary,['--host',env.DB_HOST,'--port',env.DB_PORT||'5432','--username',env.DB_USER,'--dbname',env.DB_NAME,'--data-only','--column-inserts','--no-owner','--no-privileges','--schema=public'],{env:{...env,PGPASSWORD:env.DB_PASSWORD||''},encoding:'utf8',maxBuffer:50*1024*1024});
 // pg_dump 18 session settings absent in PostgreSQL 16; retain all data and sequence statements.
 sql=sql.replace(/^SET transaction_timeout = 0;\r?\n/gm,'').replace(/^\\(?:un)?restrict[^\r\n]*\r?\n/gm,'').replaceAll('\r\n','\n');
 const dir=path.resolve(__dirname,'../../private-data');await fs.mkdir(dir,{recursive:true});
 const file=path.join(dir,'initial-data.sql');await fs.writeFile(file,sql,{mode:0o600});
 const client=new Client({host:env.DB_HOST,port:Number(env.DB_PORT||5432),user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_NAME});await client.connect();
 try{
  const counts={};const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
  for(const {tablename}of tables){if(!/^[a-z_][a-z0-9_]*$/.test(tablename))throw Error('Tabla inválida');counts[tablename]=Number((await client.query('SELECT COUNT(*) AS count FROM "'+tablename+'"')).rows[0].count);}
  await fs.writeFile(path.join(dir,'migration-manifest.json'),JSON.stringify({database:env.DB_NAME,createdAt:new Date().toISOString(),sha256:createHash('sha256').update(sql).digest('hex'),counts},null,2),{mode:0o600});
  console.log('Datos PostgreSQL exportados a private-data/initial-data.sql; '+Object.values(counts).reduce((a,b)=>a+b,0)+' registros. No publicar esta copia en Git.');
 }finally{await client.end();}
}
run().catch(error=>{console.error('No se pudo exportar: '+(error.code||'ERROR'));process.exitCode=1;});
