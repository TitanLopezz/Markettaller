export const createPortal=gateway=>({
  account:(action,body)=>gateway.account(action,body),products:options=>gateway.products(options),
  saveProduct:(id,body,options)=>gateway.saveProduct(id,body,options),deleteProduct:(id,options)=>gateway.deleteProduct(id,options),
  createProviderOrder:(body,options)=>gateway.createProviderOrder(body,options),providerOrders:options=>gateway.providerOrders(options),
  pendingApprovals:options=>gateway.pendingApprovals(options),resolveApproval:(type,id,status,options)=>gateway.resolveApproval(type,id,status,options),
})
