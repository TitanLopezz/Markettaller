const fs=require('node:fs/promises'),path=require('node:path');
const {Client}=require('pg');
require('dotenv').config({path:path.join(__dirname,'../../../.env')});
async function run(){
 const database=process.env.DB_NAME;
 if(!database||!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(database))throw Error('DB_NAME inválido');
 const settings={host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER,password:process.env.DB_PASSWORD||''};
 const admin=new Client({...settings,database:process.env.DB_ADMIN_DATABASE||'postgres'});await admin.connect();
 try{if(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount)await admin.query('CREATE DATABASE "'+database+'"');}finally{await admin.end();}
 const client=new Client({...settings,database});await client.connect();
 try{await client.query('BEGIN');for(const file of ['schema.sql','commerce.sql'])await client.query(await fs.readFile(path.join(__dirname,file),'utf8'));await client.query('COMMIT');console.log('Esquema PostgreSQL listo: '+database);}
 catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
}
run().catch(error=>{console.error('No se pudo preparar PostgreSQL:',error.message);process.exitCode=1;});
