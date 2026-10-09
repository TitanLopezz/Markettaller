const {fail}=require('../../domain/errors');
const createAuthenticateSession=({userRepository})=>async identity=>{
  const user=await userRepository.findById(identity.id);
  if(!user||user.status!=='aprobado'||user.role!==identity.role||Number(user.authVersion)!==Number(identity.version))throw fail('Sesión expirada. Inicia sesión de nuevo.','UNAUTHORIZED');
  return identity;
};
module.exports={createAuthenticateSession};
