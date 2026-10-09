const {fail}=require('../../domain/errors');
const createResolveProductRequest=({unitOfWork})=>async(id,status,reviewerId)=>{
  try{return await unitOfWork.run(async({productRequests,products})=>{
    const request=await productRequests.lockById(id);
    if(!request)return null;
    if(request.status!=='pendiente')return {updated:false,id:request.id,status:request.status};
    if(status==='aprobado'&&request.request_type==='crear')await products.create(request.product_data);
    if(status==='aprobado'&&request.request_type==='eliminar'&&!await products.delete(request.product_id))throw fail('El producto de la solicitud ya no existe.','NOT_FOUND');
    await productRequests.setStatus(id,status,reviewerId);
    return {updated:true,id:request.id,status,requestType:request.request_type,product:request.product_data};
  });}catch(error){if(error.code==='REFERENCED')throw fail('No se puede eliminar el producto porque tiene pedidos asociados.','CONFLICT');throw error;}
};
module.exports={createResolveProductRequest};
