const fs=require('node:fs/promises');
const path=require('node:path');
const mysql=require('mysql2/promise');
const {Client}=require('pg');
require('dotenv').config({path:path.join(__dirname,'../.env')});
const tables=['users','products','user_security','product_requests','orders','customer_addresses','shop_orders','shop_order_items','shop_notifications','password_reset_tokens','shop_fulfillment'];
const identifier=name=>{if(!/^[a-z_][a-z0-9_]*$/.test(name))throw Error('Identificador inválido');return '"'+name+'"';};
async function run(){
 if(process.env.MYSQL_SOURCE_PASSWORD===undefined)throw Error('Define MYSQL_SOURCE_PASSWORD solo en la terminal.');
 const source=await mysql.createConnection({host:process.env.MYSQL_SOURCE_HOST||'127.0.0.1',port:Number(process.env.MYSQL_SOURCE_PORT||3306),user:process.env.MYSQL_SOURCE_USER||'root',password:process.env.MYSQL_SOURCE_PASSWORD,database:process.env.MYSQL_SOURCE_DATABASE||process.env.DB_NAME,timezone:'Z',supportBigNumbers:true,bigNumberStrings:true});
 const target=new Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
 let connected=false,transaction=false;
 try{
  await source.query("SET time_zone='+00:00'");
  await source.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await source.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
  const snapshot={createdAt:new Date().toISOString(),tables:{}};
  for(const table of tables){const [rows]=await source.query('SELECT * FROM `'+table+'` ORDER BY '+(table==='password_reset_tokens'?'token_hash':table==='user_security'?'user_id':table==='shop_fulfillment'?'order_id':'id'));snapshot.tables[table]=rows;}
  await source.commit();
  const privateDir=path.resolve(__dirname,'../../private-data');await fs.mkdir(privateDir,{recursive:true});
  const backup=path.join(privateDir,'mysql-snapshot-'+Date.now()+'.json');await fs.writeFile(backup,JSON.stringify(snapshot,null,2),{mode:0o600});
  await target.connect();connected=true;await target.query('BEGIN');transaction=true;
  await target.query('LOCK TABLE '+tables.map(identifier).join(',')+' IN ACCESS EXCLUSIVE MODE');
  for(const table of tables){if((await target.query('SELECT 1 FROM '+identifier(table)+' LIMIT 1')).rowCount)throw Error('Destino contiene datos; no se sobrescribió: '+table);}
  for(const table of tables){
   const columns=(await target.query('SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',['public',table])).rows;
   for(const row of snapshot.tables[table]){
    const names=columns.map(c=>c.column_name).filter(k=>Object.hasOwn(row,k));
    const values=names.map(k=>{const type=columns.find(c=>c.column_name===k).data_type;const value=row[k];if(value===null)return null;if(type==='boolean')return Boolean(value);if(type==='jsonb')return typeof value==='string'?value:JSON.stringify(value);return value;});
    await target.query('INSERT INTO '+identifier(table)+' ('+names.map(identifier).join(',')+') VALUES ('+names.map((_,i)=>'$'+(i+1)).join(',')+')',values);
   }
   const count=Number((await target.query('SELECT COUNT(*) AS count FROM '+identifier(table))).rows[0].count);
   if(count!==snapshot.tables[table].length)throw Error('Conteo incorrecto en '+table);
   const seq=columns.some(c=>c.column_name==='id')?(await target.query("SELECT pg_get_serial_sequence($1,'id') AS name",[table])).rows[0].name:null;
   if(seq)await target.query('SELECT setval($1::regclass,COALESCE((SELECT MAX(id) FROM '+identifier(table)+'),1),EXISTS(SELECT 1 FROM '+identifier(table)+'))',[seq]);
  }
  await target.query('COMMIT');transaction=false;
  for(const table of tables)console.log(table+': '+snapshot.tables[table].length+' registros transferidos');
  console.log('Migración confirmada. Copia privada del origen guardada fuera de Git.');
 }catch(error){if(transaction)await target.query('ROLLBACK');throw error;}
 finally{await source.end();if(connected)await target.end();}
}
run().catch(error=>{console.error('No se completó la migración: '+(error.code||error.message));process.exitCode=1;});
