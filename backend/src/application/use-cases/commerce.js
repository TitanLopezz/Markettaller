const {fail}=require('../../domain/errors');
const {text,positiveId,addressInput,checkoutInput,toCents}=require('../../domain/commerceInput');
const {orderChanges,assertFulfillmentChanges}=require('../../domain/shopOrder');

const createCommerceUseCases=({repository,unitOfWork,passwordHasher,crypto,mailer,clock,logger,config,frontendOrigin})=>{
  const getOrder=async(id,userId,staff=false)=>{
    const order=await repository.findOrder(positiveId(id));
    if(!order||(!staff&&Number(order.user_id)!==Number(userId)))throw fail('Pedido no encontrado.','NOT_FOUND');
    return {...order,items:await repository.orderItems(id),...(staff?{fulfillment:await repository.fulfillment(id)}:{})};
  };
  const mailOrder=async order=>{
    try{const user=await repository.findUser(order.user_id);if(user)await mailer.send(user.email,`Pedido #${order.id}: ${order.status}`,`Pedido #${order.id}\nEstado: ${order.status}\nPago: ${order.payment_status}\nTotal: ${(Number(order.total_cents)/100).toFixed(2)} MXN\nConsulta el detalle en tu cuenta.`);}
    catch{logger.error('No se pudo enviar el correo del pedido; la notificación está disponible en la cuenta.');}
  };
  const checkout=async(userId,input)=>{
    const normalized=checkoutInput(input);
    const data={...normalized,request_hash:crypto.hash(JSON.stringify({items:normalized.items,address:normalized.address,payment_method:normalized.payment_method}))};
    if(!config.payment_methods.includes(data.payment_method))throw fail('Ese método de pago no está habilitado.');
    let result;
    try{
      result=await unitOfWork.run(async({commerce:repo})=>{
        const user=await repo.findUser(userId);
        if(!user||user.role!=='cliente'||user.status!=='aprobado')throw fail('Se requiere una cuenta de cliente activa.','FORBIDDEN');
        const existing=await repo.findRequest(userId,data.request_key);
        if(existing){if(existing.request_hash!==data.request_hash)throw fail('La clave ya pertenece a otro carrito. Genera una nueva compra.','CONFLICT');return {id:existing.id,repeated:true};}
        let subtotal=0;const items=[];
        for(const item of data.items){
          const product=await repo.lockProduct(item.product_id);
          if(!product)throw fail('Uno de los productos ya no existe.','CONFLICT');
          if(Number(product.stock)<item.quantity)throw fail(`Stock insuficiente: ${product.nombre}.`,'CONFLICT');
          const unit_price_cents=toCents(product.precio);subtotal+=unit_price_cents*item.quantity;
          if(!Number.isSafeInteger(subtotal)||subtotal>100000000)throw fail('El pedido supera el importe permitido.');
          items.push({...item,product,unit_price_cents});
        }
        const shipping=subtotal>=config.free_shipping_cents?0:config.shipping_fee_cents;
        const id=await repo.insertOrder(userId,data,subtotal,shipping);
        for(const item of items){await repo.changeStock(item.product_id,-item.quantity);await repo.insertItem(id,item);}
        await repo.notify(userId,id,`Recibimos tu pedido #${id}. Total: ${((subtotal+shipping)/100).toFixed(2)} MXN.`);
        return {id};
      });
    }catch(error){
      if(error.code!=='DUPLICATE')throw error;
      const existing=await repository.findRequest(userId,data.request_key);
      if(existing?.request_hash!==data.request_hash)throw fail('La clave ya pertenece a otro carrito.','CONFLICT');
      result={id:existing.id,repeated:true};
    }
    const order=await getOrder(result.id,userId);if(!result.repeated)await mailOrder(order);return order;
  };
  const updateOrder=async(idValue,userId,input,staff)=>{
    const id=positiveId(idValue);
    await unitOfWork.run(async({commerce:repo})=>{
      const order=await repo.lockOrder(id);
      if(!order||(!staff&&Number(order.user_id)!==Number(userId)))throw fail('Pedido no encontrado.','NOT_FOUND');
      const normalized={...input};
      if(input.carrier!==undefined)normalized.carrier=text(input.carrier,'Transportista',120);
      if(input.tracking_number!==undefined)normalized.tracking_number=text(input.tracking_number,'Guía',160);
      const changes=orderChanges(order,normalized,staff,Boolean((await repo.fulfillment(id))?.instructions));
      if(changes.status==='cancelado')for(const item of await repo.orderItems(id))if(item.product_id)await repo.changeStock(item.product_id,item.quantity);
      await repo.updateOrder(id,changes);
      await repo.notify(order.user_id,id,`Pedido #${id}: ${changes.status}. Pago: ${changes.payment_status}.`);
    });
    const order=await getOrder(id,userId,staff);await mailOrder(order);return order;
  };
  return {
    config,checkout,getOrder,updateOrder,
    updateFulfillment:async(id,userId,input)=>{assertFulfillmentChanges(input);return updateOrder(id,userId,input,true);},
    catalog:()=>repository.catalog(),
    async listOrders(userId,staff=false,page=1){
      const offset=(positiveId(page)-1)*20;if(offset>1000000)throw fail('Página fuera de rango.');
      const rows=await repository.listOrders(userId,staff,offset);
      for(const order of rows){order.items=await repository.orderItems(order.id);if(staff)order.fulfillment=await repository.fulfillment(order.id);}
      return rows;
    },
    async saveFulfillment(idValue,userId,input){
      const id=positiveId(idValue),instructions=text(input.instructions,'Instrucciones',2000);
      await unitOfWork.run(async({commerce:repo})=>{
        const order=await repo.lockOrder(id);if(!order)throw fail('Pedido no encontrado.','NOT_FOUND');
        if(['enviado','entregado','cancelado'].includes(order.status))throw fail('Las instrucciones ya no pueden modificarse después del despacho o cierre.','CONFLICT');
        await repo.saveFulfillment(id,userId,instructions);
      });return getOrder(id,userId,true);
    },
    addresses:userId=>repository.addresses(userId),
    async saveAddress(userId,input){const address=addressInput(input);return unitOfWork.run(async({commerce:repo})=>{await repo.lockUser(userId);if(await repo.addressCount(userId)>=10)throw fail('Puedes guardar hasta 10 direcciones.');return repo.insertAddress(userId,address);});},
    async deleteAddress(userId,id){await repository.deleteAddress(userId,positiveId(id));return {message:'Dirección eliminada.'};},
    notifications:userId=>repository.notifications(userId),
    async readNotifications(userId){await repository.readNotifications(userId);return {message:'Notificaciones leídas.'};},
    async forgotPassword(input){
      if(!config.password_recovery_enabled)throw fail('La recuperación por correo aún no está configurada.','UNAVAILABLE');
      const email=text(input.email,'Email',254).toLowerCase();const user=await repository.findUserByEmail(email);
      if(user){const token=crypto.randomToken(),hash=crypto.hash(token),expiresAt=new Date(clock.now().getTime()+30*60*1000);
        await unitOfWork.run(async({commerce:repo})=>{await repo.lockUser(user.id);await repo.deleteResetTokens(user.id);await repo.insertResetToken(hash,user.id,expiresAt);});
        try{await mailer.send(email,'Recuperar contraseña',`Abre ${frontendOrigin}/#reset=${token}\nEl enlace caduca en 30 minutos y se usa una sola vez.`);}catch{logger.error('No se pudo enviar un correo de recuperación.');}
      }return {message:'Si existe una cuenta con ese correo, recibirás un enlace de recuperación.'};
    },
    async resetPassword(input){
      if(typeof input.token!=='string'||!/^[a-f0-9]{64}$/.test(input.token))throw fail('Enlace inválido.');
      if(typeof input.password!=='string'||input.password.length<8||crypto.byteLength(input.password)>72)throw fail('La contraseña debe tener al menos 8 caracteres y máximo 72 bytes.');
      const hash=crypto.hash(input.token),passwordHash=await passwordHasher.hash(input.password);
      await unitOfWork.run(async({commerce:repo})=>{
        const candidate=await repo.findResetToken(hash);if(!candidate)throw fail('Enlace inválido o expirado.');
        await repo.lockUser(candidate.user_id);const token=await repo.findResetToken(hash,true);
        if(!token||new Date(token.expires_at)<=clock.now())throw fail('Enlace inválido o expirado.');
        await repo.updatePassword(token.user_id,passwordHash);await repo.invalidateSessions(token.user_id);await repo.deleteResetTokens(token.user_id);
      });return {message:'Contraseña actualizada. Inicia sesión de nuevo.'};
    },
  };
};
module.exports={createCommerceUseCases};
