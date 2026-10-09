const {createCommerceUseCases}=require('../application/use-cases/commerce');
const {MySQLCommerceRepository}=require('../infrastructure/repositories/MySQLCommerceRepository');
const {MySQLUnitOfWork}=require('../infrastructure/database/MySQLUnitOfWork');
const {BcryptPasswordHasher}=require('../infrastructure/services/BcryptPasswordHasher');
const {NodeCryptoService}=require('../infrastructure/services/NodeCryptoService');
const {ResendMailer}=require('../infrastructure/services/ResendMailer');
const {commerceConfig}=require('../infrastructure/config/commerceConfig');
const {assertPort}=require('../application/ports/contracts');
const createCommerce=(pool,env=process.env,mailOverride)=>{
  const config=commerceConfig(env);if(mailOverride)config.password_recovery_enabled=true;
  return createCommerceUseCases({repository:assertPort('CommerceRepository',new MySQLCommerceRepository(pool)),unitOfWork:assertPort('UnitOfWork',new MySQLUnitOfWork(pool)),passwordHasher:assertPort('PasswordHasher',new BcryptPasswordHasher()),crypto:assertPort('CryptoService',new NodeCryptoService()),mailer:assertPort('Mailer',mailOverride?{send:mailOverride}:new ResendMailer({apiKey:env.RESEND_API_KEY,from:env.MAIL_FROM})),clock:{now:()=>new Date()},logger:console,config,frontendOrigin:env.FRONTEND_ORIGIN});
};
module.exports={createCommerce};
