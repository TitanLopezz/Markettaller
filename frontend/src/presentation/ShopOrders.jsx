import { useEffect, useState } from 'react'
import {store} from '../bootstrap/services.js'
import {money} from '../domain/money.js'

const transition = {recibido:'confirmado',confirmado:'preparando',preparando:'enviado',enviado:'entregado'}
const labels = {confirmado:'Confirmar',preparando:'Preparar',enviado:'Registrar envío',entregado:'Completar entrega'}
const paymentLabel = method => method === 'transferencia' ? 'Transferencia bancaria' : 'Pago contra entrega'

export function OrderReceipt({order}) {
  const a = order.address
  return <section className="order-receipt" aria-label={`Comprobante del pedido ${order.id}`}>
    <div className="shop-row"><h3>Pedido #{order.id}</h3><strong>{money(order.total_cents)}</strong></div>
    <p>{new Date(order.created_at).toLocaleString('es-MX')} · {order.status} · Pago {order.payment_status}</p>
    <ul>{order.items.map(item=><li key={item.id}>{item.product_name} × {item.quantity} — {money(item.unit_price_cents)} c/u · {money(Number(item.unit_price_cents)*item.quantity)}</li>)}</ul>
    <p>Productos: {money(order.subtotal_cents)} · Envío: {money(order.shipping_cents)} · Moneda: {order.currency}</p>
    <p>{paymentLabel(order.payment_method)}</p>
    <p>Entrega a {a.recipient} · {a.phone}<br/>{a.street}, {a.district}, {a.city}, {a.state}, CP {a.postal_code}, México</p>
    {order.tracking_number && <p>Transportista: {order.carrier} · Guía: <strong>{order.tracking_number}</strong></p>}
    {order.fulfillment && <div className="dispatch-instructions"><h4>Instrucciones internas de preparación y envío</h4><p>{order.fulfillment.instructions}</p><small>Registradas por {order.fulfillment.author_name} · {new Date(order.fulfillment.updated_at).toLocaleString('es-MX')}</small></div>}
    <small>Comprobante de pedido; no es una factura fiscal.</small>
    <button className="secondary-btn no-print" onClick={event=>{
      const receipt=event.currentTarget.closest('.order-receipt')
      receipt.classList.add('selected-receipt');document.body.classList.add('printing-receipt')
      window.print()
      receipt.classList.remove('selected-receipt');document.body.classList.remove('printing-receipt')
    }}>Imprimir comprobante</button>
  </section>
}

function AdminActions({order,onUpdate,onSaveInstructions,busy,manager}) {
  const [carrier,setCarrier] = useState(order.carrier || '')
  const [tracking,setTracking] = useState(order.tracking_number || '')
  const [instructions,setInstructions] = useState(order.fulfillment?.instructions || '')
  if (['cancelado','entregado'].includes(order.status)) return null
  const next = transition[order.status]
  return <div className="admin-shop-actions no-print">
    {['recibido','confirmado','preparando'].includes(order.status) && <div className="dispatch-form">
      <label>Instrucciones para preparar y enviar<textarea rows={4} maxLength={2000} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="Ejemplo: revisar cantidades, proteger piezas frágiles, empacar por separado y entregar a paquetería."/></label>
      <button className="secondary-btn" disabled={busy||!instructions.trim()} onClick={()=>onSaveInstructions(order.id,instructions)}>Guardar instrucciones</button>
    </div>}
    {manager && order.payment_status==='pendiente' && <p>El Super Admin registra los pagos. Para transferencia, espera su confirmación antes de enviar; para contra entrega, antes de completar la entrega.</p>}
    {order.status === 'preparando' && <div className="shop-form-grid">
      <label>Transportista<input value={carrier} maxLength={120} onChange={e=>setCarrier(e.target.value)}/></label>
      <label>Número de guía<input value={tracking} maxLength={160} onChange={e=>setTracking(e.target.value)}/></label>
    </div>}
    <div className="shop-row">
      {next && <button className="primary-btn" disabled={busy} onClick={()=>onUpdate(order.id,{status:next,...(next === 'enviado'?{carrier,tracking_number:tracking}:{})})}>{labels[next]}</button>}
      {!manager && order.payment_status === 'pendiente' && <button className="secondary-btn" disabled={busy} onClick={()=>{
        if(window.confirm('¿Confirmas que recibiste el pago completo? Esta acción solo registra un pago recibido.')) onUpdate(order.id,{payment_status:'pagado'})
      }}>Aceptar pago / transacción</button>}
      {!manager && ['recibido','confirmado','preparando'].includes(order.status) && <button className="reject-btn" disabled={busy} onClick={()=>{
        const paid = order.payment_status === 'pagado'
        if(window.confirm(paid?'¿Ya devolviste el dinero al cliente? Se registrará el reembolso y se cancelará el pedido.':'¿Cancelar el pedido y devolver sus existencias al catálogo?')) onUpdate(order.id,{status:'cancelado',...(paid?{payment_status:'reembolsado'}:{})})
      }}>{order.payment_status === 'pagado'?'Registrar reembolso y cancelar':'Cancelar pedido'}</button>}
    </div>
  </div>
}

export default function ShopOrders({token,admin=false,manager=false}) {
  const staff=admin||manager
  const scope=admin?'admin':manager?'fulfillment':''
  const [orders,setOrders] = useState([])
  const [page,setPage] = useState(1)
  const [reload,setReload] = useState(0)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  useEffect(()=>{
    const controller = new AbortController()
    store.listOrders({scope,page,token,signal:controller.signal}).then(data=>{setOrders(data);setError('')}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setBusy(false)})
    return ()=>controller.abort()
  },[token,scope,page,reload])
  const update = async (id,body) => {
    setBusy(true);setError('')
    try {
      const order = await (staff?store.updateOrder(id,body,{scope,token}):store.cancelOrder(id,{token}))
      setOrders(current=>current.map(item=>item.id===order.id?order:item))
    } catch(e) {setError(e.message)} finally {setBusy(false)}
  }
  const saveInstructions=async(id,instructions)=>{
    setBusy(true);setError('')
    try{
      const order=await store.saveInstructions(id,instructions,{token})
      setOrders(current=>current.map(item=>item.id===order.id?order:item))
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <section className="shop-section">
    <div className="shop-row"><h2>{admin?'Ventas y entregas':manager?'Compras y despachos':'Mis compras'}</h2><button className="secondary-btn no-print" disabled={busy} onClick={()=>setReload(v=>v+1)}>Actualizar</button></div>
    {manager && <p>Revisa los productos comprados, guarda las instrucciones de preparación y coordina su despacho. Puedes imprimir el pedido con sus instrucciones para quien lo empaca y envía.</p>}
    {error && <p className="status error" role="alert">{error}</p>}
    {busy && <p role="status">Procesando…</p>}
    {!busy && !orders.length && <p>Aún no hay compras en esta página.</p>}
    {orders.map(order=><article className="shop-order" key={order.id}>
      {staff && <p>Cliente: {order.customer_name}</p>}
      <OrderReceipt order={order}/>
      {staff ? <AdminActions order={order} onUpdate={update} onSaveInstructions={saveInstructions} manager={manager} busy={busy}/> : ['recibido','confirmado'].includes(order.status) && order.payment_status!=='pagado' && <button className="reject-btn no-print" disabled={busy} onClick={()=>{if(window.confirm('¿Cancelar esta compra?'))update(order.id,{})}}>Cancelar compra</button>}
    </article>)}
    <nav className="shop-row no-print" aria-label="Páginas de pedidos">
      <button className="secondary-btn" disabled={page===1||busy} onClick={()=>setPage(v=>v-1)}>Anterior</button><span>Página {page}</span>
      <button className="secondary-btn" disabled={orders.length<20||busy} onClick={()=>setPage(v=>v+1)}>Siguiente</button>
    </nav>
  </section>
}
