const createSubmitProductChange=({createProduct,deleteProduct,createProductRequest})=>async({actor,requestType,product,productId})=>{
  if(actor.role!=='super_admin')return {pending:true,request:await createProductRequest({requesterId:actor.id,requestType,product,productId})};
  return requestType==='crear'?{pending:false,product:await createProduct(product)}:{pending:false,result:await deleteProduct(productId)};
};
module.exports={createSubmitProductChange};
