/**
 * StoreGateway: catalog, config, addresses, saveAddress, deleteAddress, notifications,
 * readNotifications, checkout, listOrders, updateOrder, cancelOrder, saveInstructions,
 * forgotPassword, resetPassword. Each operation returns plain data, never a Response.
 * PortalGateway: account, products, saveProduct, deleteProduct, createProviderOrder,
 * providerOrders, pendingApprovals, resolveApproval.
 * Storage: getItem, setItem, removeItem. ImageLoader: load. IdGenerator: next.
 * No core module imports a browser adapter; bootstrap supplies the implementations.
 */
export const assertMethods=(port,methods)=>{
  for(const method of methods)if(typeof port?.[method]!=='function')throw new TypeError(`El puerto requiere ${method}()`)
  return port
}
