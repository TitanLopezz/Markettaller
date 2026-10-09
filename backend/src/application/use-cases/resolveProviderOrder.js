const {fail}=require('../../domain/errors');
const createResolveProviderOrder=({unitOfWork})=>async(id,status)=>unitOfWork.run(async({orders,products})=>{
  const order=await orders.lockById(id);
  if(!order)return null;
  if(order.status!=='pendiente')return {updated:false,id:order.id,status:order.status};
  if(status==='aprobado'){
    const product=await products.lockInventoryById(order.product_id);
    if(!product)throw fail('El producto del pedido ya no existe.','NOT_FOUND');
    if(Number(product.stock)<Number(order.quantity)||!await products.decreaseStock(order.product_id,order.quantity))throw fail('Stock insuficiente para aprobar el pedido.','CONFLICT');
  }
  await orders.setStatus(id,status);
  return {updated:true,id:order.id,status};
});
module.exports={createResolveProviderOrder};
