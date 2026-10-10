const {createCommerceUseCases}=require('../application/use-cases/commerce');
const {PostgresCommerceRepository}=require('../infrastructure/repositories/PostgresCommerceRepository');
const {PostgresUnitOfWork}=require('../infrastructure/database/PostgresUnitOfWork');
const {BcryptPasswordHasher}=require('../infrastructure/services/BcryptPasswordHasher');
const {NodeCryptoService}=require('../infrastructure/services/NodeCryptoService');
const {ResendMailer}=require('../infrastructure/services/ResendMailer');
const {commerceConfig}=require('../infrastructure/config/commerceConfig');
const {assertPort}=require('../application/ports/contracts');
const {NodemailAdapter}=require('../infrastructure/adapters/NodemailAdapter');
const createCommerce=(pool,env=process.env,mailOverride)=>{
  const transport=env.SMTP_HOST?require('nodemailer').createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||587),secure:env.SMTP_SECURE==='true',auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000}):null;
  const emailService=new NodemailAdapter({transport,from:env.MAIL_FROM,adminEmail:env.ADMIN_NOTIFICATION_EMAIL});
  const config=commerceConfig(env);if(mailOverride)config.password_recovery_enabled=true;
  return createCommerceUseCases({emailService,repository:assertPort('CommerceRepository',new PostgresCommerceRepository(pool)),unitOfWork:assertPort('UnitOfWork',new PostgresUnitOfWork(pool)),passwordHasher:assertPort('PasswordHasher',new BcryptPasswordHasher()),crypto:assertPort('CryptoService',new NodeCryptoService()),mailer:assertPort('Mailer',mailOverride?{send:mailOverride}:new ResendMailer({apiKey:env.RESEND_API_KEY,from:env.MAIL_FROM})),clock:{now:()=>new Date()},logger:console,config,frontendOrigin:env.FRONTEND_ORIGIN});
};
module.exports={createCommerce};
