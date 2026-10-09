const path=require('node:path');
require('dotenv').config({path:process.env.ENV_FILE||path.join(__dirname,'../.env')});
const {createPostgresPool}=require('../src/infrastructure/database/postgresPool');
const {PostgresUnitOfWork}=require('../src/infrastructure/database/PostgresUnitOfWork');
const {BcryptPasswordHasher}=require('../src/infrastructure/services/BcryptPasswordHasher');
const {createSeedSuperAdmin,assertSuperAdminAccount}=require('../src/application/use-cases/seedSuperAdmin');
const run=async()=>{
 const pool=createPostgresPool();
 try{
  const seed=createSeedSuperAdmin({unitOfWork:new PostgresUnitOfWork(pool),passwordHasher:new BcryptPasswordHasher()});
  await seed({name:process.env.SUPER_ADMIN_NAME?.trim()||'Super Admin',email:(process.env.SUPERADMIN_EMAIL||process.env.SUPER_ADMIN_EMAIL)?.trim().toLowerCase(),password:process.env.SUPERADMIN_PASSWORD||process.env.SUPER_ADMIN_PASSWORD});
  console.log('Super Admin creado o actualizado.');
 }finally{await pool.end();}
};
if(require.main===module)run().catch(error=>{console.error('No se pudo crear o actualizar Super Admin:',error.message);process.exitCode=1;});
module.exports={run,assertSuperAdminAccount};
