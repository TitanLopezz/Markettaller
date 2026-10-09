// Structural contracts: implementations are injected by bootstrap, never imported by the core.
const PORTS=Object.freeze({
  PasswordHasher:['hash','compare'],TokenService:['sign','verify'],CryptoService:['hash','randomToken','byteLength'],
  Mailer:['send'],Clock:['now'],Logger:['error'],UnitOfWork:['run'],
  UserRepository:['findByEmail','findById','create','findPending','updatePendingStatus'],
  ProductRepository:['findAll','findById','create','update','delete','lockInventoryById','decreaseStock'],
  ProviderOrderRepository:['create','findByProviderId','findPending','lockById','setStatus'],
  ProductRequestRepository:['create','hasPendingDelete','findPending','lockById','setStatus'],
  CommerceRepository:['findUser','findUserByEmail','lockUser','findRequest','lockProduct','insertOrder','changeStock','insertItem','notify','findOrder','lockOrder','orderItems','fulfillment','updateOrder','catalog','listOrders','saveFulfillment','addresses','addressCount','insertAddress','deleteAddress','notifications','readNotifications','deleteResetTokens','insertResetToken','findResetToken','updatePassword','invalidateSessions'],
});
const assertPort=(name,implementation)=>{
  for(const method of PORTS[name]||[])if(typeof implementation?.[method]!=='function')throw new TypeError(`${name} requiere ${method}()`);
  return implementation;
};
module.exports={PORTS,assertPort};
