import {sanitizeCart,addProduct,updateQuantity,estimateCart} from '../domain/cart.js'
export const createStore = ({gateway,cartStorage,requestStorage,idGenerator}) => ({
  catalog:options=>gateway.catalog(options),config:options=>gateway.config(options),
  addresses:options=>gateway.addresses(options),saveAddress:(body,options)=>gateway.saveAddress(body,options),deleteAddress:(id,options)=>gateway.deleteAddress(id,options),
  notifications:options=>gateway.notifications(options),readNotifications:options=>gateway.readNotifications(options),
  listOrders:options=>gateway.listOrders(options),updateOrder:(id,body,options)=>gateway.updateOrder(id,body,options),cancelOrder:(id,options)=>gateway.cancelOrder(id,options),
  saveInstructions:(id,instructions,options)=>gateway.saveInstructions(id,instructions,options),forgotPassword:body=>gateway.forgotPassword(body),resetPassword:body=>gateway.resetPassword(body),
  loadCart(){try{return sanitizeCart(JSON.parse(cartStorage.getItem('shopCart')||'[]'))}catch{return []}},
  saveCart(cart){try{cartStorage.setItem('shopCart',JSON.stringify(sanitizeCart(cart)))}catch{/* Keep the in-memory basket when storage is unavailable. */}},
  addProduct,updateQuantity,estimateCart,
  async checkout(body,options){
    const signature=JSON.stringify(body)
    let pending
    try{pending=JSON.parse(requestStorage.getItem('pendingCheckout')||'null')}catch{/* Create a new request key. */}
    if(pending?.signature!==signature)pending={signature,key:idGenerator.next()}
    requestStorage.setItem('pendingCheckout',JSON.stringify(pending))
    const order=await gateway.checkout({...body,request_key:pending.key},options)
    requestStorage.removeItem('pendingCheckout')
    return order
  },
})
