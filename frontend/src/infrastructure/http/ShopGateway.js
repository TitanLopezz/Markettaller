export class ShopGateway {
  constructor(http){this.http=http}
  async call(path,options){return (await this.http.request(`/api/shop${path}`,options)).data}
  catalog(options){return this.call('/catalog',options)}
  config(options){return this.call('/config',options)}
  addresses(options){return this.call('/addresses',options)}
  saveAddress(body,options){return this.call('/addresses',{...options,method:'POST',body})}
  deleteAddress(id,options){return this.call(`/addresses/${id}`,{...options,method:'DELETE'})}
  notifications(options){return this.call('/notifications',options)}
  readNotifications(options){return this.call('/notifications/read',{...options,method:'PATCH'})}
  checkout(body,options){return this.call('/checkout',{...options,method:'POST',body})}
  listOrders({scope='',page=1,...options}={}){return this.call(`${scope?`/${scope}`:''}/orders?page=${page}`,options)}
  updateOrder(id,body,{scope,...options}){return this.call(`/${scope}/orders/${id}`,{...options,method:'PATCH',body})}
  cancelOrder(id,options){return this.call(`/orders/${id}/cancel`,{...options,method:'POST',body:{}})}
  saveInstructions(id,instructions,options){return this.call(`/fulfillment/orders/${id}/instructions`,{...options,method:'PATCH',body:{instructions}})}
  forgotPassword(body){return this.call('/forgot-password',{method:'POST',body})}
  resetPassword(body){return this.call('/reset-password',{method:'POST',body})}
}
