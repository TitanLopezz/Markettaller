import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../apiError'
import {portal} from '../bootstrap/services.js'
import ProductImage from './ProductImage'

const dateFormatter = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
const statusLabels = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
}

function ProviderOrders({ user, token, onBack, onLogout }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    const loadOrders = async () => {
      setLoading(true)
      setError('')

      try {
        const result=await portal.providerOrders({token,signal:controller.signal})

        setOrders(Array.isArray(result) ? result : [])
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(getApiErrorMessage(requestError, 'No se pudo cargar el historial de pedidos.'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadOrders()
    return () => controller.abort()
  }, [token, reloadKey])

  return (
    <main className="app-shell catalog-shell">
      <section className="catalog-layout" aria-labelledby="orders-title">
        <header className="catalog-header">
          <div>
            <p className="eyebrow">NOTIFICACIONES DE PEDIDOS</p>
            <h1 id="orders-title">Mis solicitudes</h1>
            <p className="catalog-user">{user?.name} · {user?.email}</p>
          </div>
          <nav className="catalog-nav" aria-label="Acciones de cuenta">
            <button type="button" className="secondary-btn" onClick={onBack}>Volver al catálogo</button>
            <button type="button" className="secondary-btn" onClick={onLogout}>Cerrar sesión</button>
          </nav>
        </header>

        {error && <p className="status error" role="alert">{error}</p>}
        {loading ? (
          <p className="catalog-empty" role="status">Cargando solicitudes...</p>
        ) : orders.length === 0 ? (
          <p className="catalog-empty">Todavía no has solicitado productos.</p>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <article className="provider-order" key={order.id}>
                <ProductImage src={order.product_image_url} alt={order.product_name} className="" emptyClassName="provider-order-image-empty" />
                <div className="provider-order-details">
                  <p className="product-category">{order.product_name}</p>
                  <p>Cantidad solicitada: <strong>{order.quantity}</strong></p>
                  <time dateTime={new Date(order.created_at).toISOString()}>
                    {dateFormatter.format(new Date(order.created_at))}
                  </time>
                </div>
                <span className={`order-status ${order.status}`}>
                  {statusLabels[order.status] || order.status}
                </span>
              </article>
            ))}
          </div>
        )}
        {!loading && error && (
          <button type="button" className="secondary-btn retry-btn" onClick={() => setReloadKey((key) => key + 1)}>
            Reintentar
          </button>
        )}
      </section>
    </main>
  )
}

export default ProviderOrders
