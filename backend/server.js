const path=require('node:path');
require('dotenv').config({path:process.env.ENV_FILE||path.join(__dirname,'.env')});
const {createApp}=require('./src/infrastructure/http/app');
const {createPostgresPool}=require('./src/infrastructure/database/postgresPool');
const {createServices}=require('./src/bootstrap/createServices');
const start=async()=>{
 const pool=createPostgresPool();await pool.query('SELECT 1');
 const app=createApp(createServices(pool));
 const port=Number(process.env.PORT||3000);
 app.listen(port,()=>console.log('Servidor corriendo en http://localhost:'+port));
};
start().catch(error=>{console.error('No se pudo iniciar el servidor:',error.message);process.exitCode=1;});
