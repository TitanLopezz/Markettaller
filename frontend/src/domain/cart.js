export const sanitizeCart = saved => {
  if(!Array.isArray(saved))return []
  const seen=new Set()
  return saved.filter(item=>{
    const valid=item&&Number.isSafeInteger(item.product_id)&&item.product_id>0&&Number.isSafeInteger(item.quantity)&&item.quantity>0&&item.quantity<=100&&!seen.has(item.product_id)
    if(item)seen.add(item.product_id)
    return valid
  }).slice(0,50).map(({product_id,quantity})=>({product_id,quantity}))
}
export const addProduct = (cart,product) => {
  const id=Number(product.id),existing=cart.find(item=>item.product_id===id)
  if((existing?.quantity||0)>=Math.min(100,Number(product.stock)))throw new Error('No hay más stock disponible de este producto.')
  if(!existing&&cart.length>=50)throw new Error('El carrito admite hasta 50 productos diferentes.')
  return existing?cart.map(item=>item.product_id===id?{...item,quantity:item.quantity+1}:item):[...cart,{product_id:id,quantity:1}]
}
export const updateQuantity=(cart,id,quantity)=>!Number.isSafeInteger(quantity)||quantity<1||quantity>100?cart:cart.map(item=>item.product_id===id?{...item,quantity}:item)
export const estimateCart=(cart,products,config)=>{
  const lines=cart.map(item=>({...item,product:products.find(p=>Number(p.id)===item.product_id)}))
  const subtotal=lines.reduce((sum,item)=>sum+(item.product?Math.round(Number(item.product.precio)*100)*item.quantity:0),0)
  const shipping=config&&subtotal<config.free_shipping_cents?config.shipping_fee_cents:0
  return {lines,subtotal,shipping,invalid:!cart.length||lines.some(item=>!item.product||item.quantity>Number(item.product.stock))}
}
