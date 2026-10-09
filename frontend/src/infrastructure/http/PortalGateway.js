export class PortalGateway {
  constructor(http){this.http=http}
  async account(action,body){return (await this.http.request(`/api/users/${action}`,{method:'POST',body})).data}
  async products(options){return (await this.http.request('/api/products',options)).data}
  async saveProduct(id,body,options){const result=await this.http.request(id?`/api/products/${id}`:'/api/products',{...options,method:id?'PUT':'POST',body});return {...result.data,pending:result.pending}}
  async deleteProduct(id,options){const result=await this.http.request(`/api/products/${id}`,{...options,method:'DELETE'});return {...result.data,pending:result.pending}}
  async createProviderOrder(body,options){return (await this.http.request('/api/orders',{...options,method:'POST',body})).data}
  async providerOrders(options){return (await this.http.request('/api/orders/my-orders',options)).data}
  async pendingApprovals(options){return Promise.all(['/api/users/pending','/api/orders/pending','/api/products/requests/pending'].map(async path=>(await this.http.request(path,options)).data))}
  async resolveApproval(type,id,status,options){const path=type==='products'?`/api/products/requests/${id}/status`:`/api/${type}/${id}/status`;return (await this.http.request(path,{...options,method:'PATCH',body:{status}})).data}
}
