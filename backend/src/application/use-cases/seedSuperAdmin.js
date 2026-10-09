const {USER_ROLES,USER_STATUSES}=require('../../domain/user');
const {fail}=require('../../domain/errors');
const assertSuperAdminAccount=users=>{
  if(users.length&&users[0].role!==USER_ROLES.SUPER_ADMIN)throw fail('Ese email ya pertenece a otra cuenta; no se modificó su rol.','CONFLICT');
};
const createSeedSuperAdmin=({unitOfWork,passwordHasher})=>async({name,email,password})=>{
  if(!email||!password)throw fail('Configura SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD en backend/.env.');
  const passwordHash=await passwordHasher.hash(password);
  await unitOfWork.run(async({users})=>{
    const existing=await users.findByEmailForUpdate(email);assertSuperAdminAccount(existing?[existing]:[]);
    await users.upsertSuperAdmin({name,email,passwordHash,role:USER_ROLES.SUPER_ADMIN,status:USER_STATUSES.APPROVED});
    if(existing)await users.invalidateSessions(existing.id);
  });
};
module.exports={createSeedSuperAdmin,assertSuperAdminAccount};
