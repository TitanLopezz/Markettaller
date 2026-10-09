import {useEffect,useMemo,useState} from 'react'
import ProductImage from './ProductImage'
import ShopOrders, {OrderReceipt} from './ShopOrders'
import {store} from '../bootstrap/services.js'
import {money} from '../domain/money.js'
import './Storefront.css'

const blankAddress = {recipient:'',phone:'',street:'',district:'',city:'',state:'',postal_code:''}
const addressLabels = {recipient:'Nombre de quien recibe',phone:'Teléfono',street:'Calle, número e interior',district:'Colonia',city:'Ciudad',state:'Estado',postal_code:'Código postal'}

export default function Storefront({user,token,onLogin,onLogout,onPortal}) {
  const [products,setProducts] = useState([])
  const [config,setConfig] = useState(null)
  const [cart,setCart] = useState(store.loadCart)
  const [query,setQuery] = useState('')
  const [category,setCategory] = useState('')
  const [sort,setSort] = useState('name')
  const [view,setView] = useState('catalog')
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [address,setAddress] = useState(blankAddress)
  const [addresses,setAddresses] = useState([])
  const [payment,setPayment] = useState('contra_entrega')
  const [receipt,setReceipt] = useState(null)
  const [notifications,setNotifications] = useState([])
  const [reload,setReload] = useState(0)
  const customer = user?.role === 'cliente'
  useEffect(()=>{store.saveCart(cart)},[cart])
  useEffect(()=>{
    const c = new AbortController()
    Promise.all([store.catalog({signal:c.signal}),store.config({signal:c.signal})]).then(([p,cfg])=>{setProducts(p);setConfig(cfg);setError('')}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!c.signal.aborted)setLoading(false)})
    return ()=>c.abort()
  },[reload])
  useEffect(()=>{
    if (!customer) return
    const c = new AbortController()
    Promise.all([store.addresses({token,signal:c.signal}),store.notifications({token,signal:c.signal})]).then(([a,n])=>{setAddresses(a);setNotifications(n)}).catch(e=>{if(e.name!=='AbortError')setError(e.message)})
    return ()=>c.abort()
  },[customer,token,reload])
  const shown = useMemo(()=>products.filter(p=>(!category||p.categoria===category)&&`${p.nombre} ${p.descripcion}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sort==='price_up'?Number(a.precio)-Number(b.precio):sort==='price_down'?Number(b.precio)-Number(a.precio):a.nombre.localeCompare(b.nombre)),[products,query,category,sort])
  const {lines,subtotal,shipping,invalid:invalidCart}=store.estimateCart(cart,products,config)
  const changeQuantity=(id,quantity)=>setCart(current=>store.updateQuantity(current,id,quantity))
  const add=product=>{
    setNotice('');setError('')
    try{setCart(store.addProduct(cart,product));setNotice(product.nombre+' agregado al carrito.')}catch(e){setError(e.message)}
  }
  const saveAddress = async () => {
    setBusy(true);setError('')
    try{const saved=await store.saveAddress(address,{token});setAddresses(current=>[saved,...current]);setNotice('Dirección guardada.')}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const checkout = async event => {
    event.preventDefault();setError('');setBusy(true)
    try {
      const data = {items:cart,address,payment_method:payment}
      const order=await store.checkout(data,{token})
      setReceipt(order);setCart([]);setView('receipt');setReload(v=>v+1)
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const removeAddress = async id => {
    setBusy(true)
    try{await store.deleteAddress(id,{token});setAddresses(current=>current.filter(a=>a.id!==id))}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <main className="store-shell">
    <header className="store-header no-print"><button className="store-brand" onClick={()=>setView('catalog')}>Mercado<span>Tu tienda en línea</span></button>
      <nav aria-label="Tienda" className="shop-row">
        <button className="secondary-btn" onClick={()=>setView('catalog')}>Productos</button>
        <button className="primary-btn" onClick={()=>setView('cart')}>Carrito ({cart.reduce((sum,i)=>sum+i.quantity,0)})</button>
        {customer && <button className="secondary-btn" onClick={()=>setView('orders')}>Mis compras</button>}
        {customer && <button className="secondary-btn" onClick={()=>setView('account')}>Mi cuenta {notifications.some(n=>!n.is_read)?'●':''}</button>}
        {user&&!customer&&<button className="secondary-btn" onClick={onPortal}>Mi portal</button>}
        <button className="secondary-btn" onClick={user?onLogout:onLogin}>{user?'Cerrar sesión':'Entrar / Registrarse'}</button>
      </nav>
    </header>
    {error&&<p className="status error" role="alert">{error}</p>}{notice&&<p className="status success" role="status">{notice}</p>}
    {view==='catalog'&&<>
      <section className="store-hero"><p className="eyebrow">ENCUENTRA TU PRÓXIMA COMPRA</p><h1>Productos para ti,<br/>en un solo lugar.</h1><p>Compra en pesos mexicanos. {config&&<>Envío {money(config.shipping_fee_cents)} o gratis desde {money(config.free_shipping_cents)}.</>}</p></section>
      <section className="store-filters no-print" aria-label="Filtrar catálogo">
        <label>Buscar<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nombre o descripción"/></label>
        <label>Categoría<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Todas las categorías</option>{[...new Set(products.map(p=>p.categoria))].map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Ordenar<select value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Nombre</option><option value="price_up">Menor precio</option><option value="price_down">Mayor precio</option></select></label>
      </section>
      {loading?<p role="status">Cargando productos…</p>:<><p>{shown.length} productos</p><div className="product-grid">{shown.map(product=><article className="product-card" key={product.id}>
        <ProductImage src={product.imagen_url} alt={product.nombre}/><div className="product-card-body"><p className="product-category">{product.categoria}</p><h2>{product.nombre}</h2><p className="product-description">{product.descripcion}</p><strong>{money(Math.round(Number(product.precio)*100))}</strong><p>{Number(product.stock)>0?`${product.stock} disponibles`:'Agotado'}</p><button className="primary-btn" disabled={!Number(product.stock)} onClick={()=>add(product)}>Agregar al carrito</button></div>
      </article>)}</div>{!shown.length&&<p>No encontramos productos. Prueba otra búsqueda.</p>}</>}
      {error&&<button className="secondary-btn" onClick={()=>setReload(v=>v+1)}>Reintentar</button>}
    </>}
    {view==='cart'&&<section className="shop-section"><h1>Tu carrito</h1>{!cart.length?<p>Tu carrito está vacío. Explora el catálogo para comenzar.</p>:<>
      <div className="cart-lines">{lines.map(item=><article className="cart-line" key={item.product_id}>
        <div><h3>{item.product?.nombre||'Producto no disponible'}</h3><p>{item.product?money(Math.round(Number(item.product.precio)*100)):'Retira este artículo para continuar.'}</p>{item.product&&item.quantity>Number(item.product.stock)&&<p role="alert">Stock disponible: {item.product.stock}. Ajusta la cantidad.</p>}</div>
        <label>Cantidad<input type="number" min="1" max={Math.min(100,Number(item.product?.stock)||100)} value={item.quantity} onChange={e=>changeQuantity(item.product_id,Number(e.target.value))}/></label>
        <button className="reject-btn" onClick={()=>setCart(current=>current.filter(i=>i.product_id!==item.product_id))}>Quitar</button>
      </article>)}</div>
      <aside className="cart-summary"><p>Productos: {money(subtotal)}</p><p>Envío: {money(shipping)}</p><h2>Total estimado: {money(subtotal+shipping)}</h2><p>El servidor comprobará precios y existencias al confirmar.</p></aside>
      {!user?<button className="primary-btn" onClick={onLogin}>Inicia sesión para comprar</button>:!customer?<p>Para comprar necesitas una cuenta de tipo Cliente. Tu cuenta actual mantiene sus funciones de gestión.</p>:<form className="checkout-form" onSubmit={checkout}>
        <h2>Dirección de entrega</h2>
        {!!addresses.length&&<label>Usar una dirección guardada<select defaultValue="" onChange={e=>{const saved=addresses.find(a=>String(a.id)===e.target.value);setAddress(saved?.address||blankAddress)}}><option value="">Nueva dirección</option>{addresses.map(a=><option key={a.id} value={a.id}>{a.address.street}, {a.address.city}</option>)}</select></label>}
        <div className="shop-form-grid">{Object.entries(addressLabels).map(([key,label])=><label key={key}>{label}<input required name={key} autoComplete={key==='recipient'?'name':key==='phone'?'tel':key==='postal_code'?'postal-code':'off'} type={key==='phone'?'tel':'text'} maxLength={key==='postal_code'?5:key==='street'?200:120} pattern={key==='postal_code'?'[0-9]{5}':undefined} value={address[key]} onChange={e=>setAddress(current=>({...current,[key]:e.target.value}))}/></label>)}</div>
        <p>País de entrega: México</p><button type="button" className="secondary-btn" disabled={busy} onClick={saveAddress}>Guardar dirección para otras compras</button>
        <label>Forma de pago<select value={payment} onChange={e=>setPayment(e.target.value)}>{(config?.payment_methods||['contra_entrega']).map(method=><option value={method} key={method}>{method==='transferencia'?'Transferencia bancaria':'Pago contra entrega'}</option>)}</select></label>
        {payment==='transferencia'&&<p className="transfer-instructions">{config?.transfer_instructions}<br/>Usa tu número de pedido como referencia después de confirmarlo. El pago se verificará manualmente.</p>}
        <button className="primary-btn" type="submit" disabled={busy||loading||!config||invalidCart}>{busy?'Confirmando…':`Confirmar compra · ${money(subtotal+shipping)}`}</button>
      </form>}
    </>}</section>}
    {view==='receipt'&&receipt&&<section className="shop-section"><h1>¡Recibimos tu compra!</h1><OrderReceipt order={receipt}/>{receipt.payment_method==='transferencia'&&<p className="transfer-instructions">{config?.transfer_instructions}<br/>Referencia: pedido #{receipt.id}</p>}<button className="primary-btn no-print" onClick={()=>setView('orders')}>Ver mis compras</button></section>}
    {view==='orders'&&customer&&<ShopOrders token={token}/>}
    {view==='account'&&customer&&<section className="shop-section"><h1>Hola, {user.name}</h1><p>{user.email}</p><h2>Direcciones guardadas</h2>{!addresses.length&&<p>Puedes guardar una dirección desde el checkout.</p>}{addresses.map(a=><div className="shop-row" key={a.id}><p>{a.address.recipient}: {a.address.street}, {a.address.city}, {a.address.state}, {a.address.postal_code}</p><button className="reject-btn" disabled={busy} onClick={()=>removeAddress(a.id)}>Eliminar</button></div>)}
      <h2>Notificaciones</h2>{!notifications.length&&<p>No hay notificaciones.</p>}{notifications.map(n=><p key={n.id}>{!n.is_read&&'● '}{n.message} <small>{new Date(n.created_at).toLocaleString('es-MX')}</small></p>)}
      <button className="secondary-btn" onClick={async()=>{try{await store.readNotifications({token});setReload(v=>v+1)}catch(e){setError(e.message)}}}>Marcar como leídas</button>
    </section>}
    <footer className="store-footer no-print"><p>Precios en MXN · Entregas en México · {config?.payment_methods.includes('transferencia')?'Pago contra entrega o transferencia':'Pago contra entrega'}</p><p>Consulta el estado de tu compra y el comprobante desde Mi cuenta.</p></footer>
  </main>
}
