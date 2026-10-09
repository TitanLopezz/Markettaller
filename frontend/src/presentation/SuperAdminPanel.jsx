import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../apiError'
import {portal,session} from '../bootstrap/services.js'
import ProductImage from './ProductImage'
import ShopOrders from './ShopOrders'

const orderDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

function roleLabel(role) {
  return role === 'proveedor' ? 'Proveedor' : 'Gestor de Productos'
}

function roleBadgeClass(role) {
  return role === 'proveedor' ? 'role-badge role-badge-provider' : 'role-badge role-badge-manager'
}

function SuperAdminPanel({ token, onBack }) {
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [productRequests, setProductRequests] = useState([])
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = session.getItem('adminApprovalTab')
    return ['users', 'orders', 'products', 'sales'].includes(savedTab) ? savedTab : 'users'
  })
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const selectTab = (tab) => {
    session.setItem('adminApprovalTab', tab)
    setActiveTab(tab)
    setRefreshKey((currentKey) => currentKey + 1)
    setError('')
    setNotice('')
  }

  useEffect(() => {
    const controller = new AbortController()

    const loadPendingRequests = async () => {
      setLoading(true)
      setError('')

      try {
        const results=await portal.pendingApprovals({token,signal:controller.signal})

        setUsers(Array.isArray(results[0]) ? results[0] : [])
        setOrders(Array.isArray(results[1]) ? results[1] : [])
        setProductRequests(Array.isArray(results[2]) ? results[2] : [])
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(getApiErrorMessage(requestError, 'No se pudo cargar la lista de solicitudes.'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadPendingRequests()
    return () => controller.abort()
  }, [refreshKey, token])

  const updateStatus = async (item, status) => {
    const isUser = activeTab === 'users'
    const isOrder = activeTab === 'orders'
    setBusyId(item.id)
    setError('')
    setNotice('')

    try {
      await portal.resolveApproval(activeTab,item.id,status,{token})

      if (isOrder) {
        setOrders((currentOrders) => currentOrders.filter((order) => order.id !== item.id))
        setNotice(`Pedido de ${item.product_name}: ${status === 'aprobado' ? 'aprobado' : 'rechazado'}.`)
      } else if (isUser) {
        setUsers((currentUsers) => currentUsers.filter((user) => user.id !== item.id))
        setNotice(`${item.name}: cuenta ${status === 'aprobado' ? 'aprobada' : 'rechazada'}.`)
      } else {
        setProductRequests((currentRequests) => currentRequests.filter((request) => request.id !== item.id))
        const action = item.request_type === 'crear' ? 'alta' : 'eliminación'
        setNotice(`Solicitud de ${action} para ${item.product_data.nombre}: ${status}.`)
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No se pudo actualizar la solicitud.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="app-shell">
      <section className="card admin-card" aria-labelledby="admin-title">
        <div className="admin-heading-row">
          <div>
            <p className="eyebrow">SUPER ADMIN</p>
            <h1 id="admin-title">Panel de administración</h1>
          </div>
          <button type="button" className="secondary-btn admin-back" onClick={onBack}>
            Volver al catálogo
          </button>
        </div>

        <p className="form-intro">
          {activeTab === 'sales'
            ? 'Consulta las compras, las instrucciones del gestor y los envíos. Acepta los pagos solo después de comprobar que recibiste el dinero.'
            : activeTab === 'users'
            ? 'Revisa las cuentas que solicitan acceso.'
            : activeTab === 'orders'
              ? 'Revisa los pedidos enviados por proveedores.'
              : 'Revisa las solicitudes de alta y eliminación de productos.'}
        </p>

        <div className="approval-tabs" role="tablist" aria-label="Secciones de administración">
          <button type="button" role="tab" aria-selected={activeTab === 'sales'} className={activeTab === 'sales' ? 'approval-tab active' : 'approval-tab'} onClick={() => selectTab('sales')}>
            Compras y transacciones
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'users'}
            className={activeTab === 'users' ? 'approval-tab active' : 'approval-tab'}
            onClick={() => selectTab('users')}
          >
            Usuarios ({users.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'orders'}
            className={activeTab === 'orders' ? 'approval-tab active' : 'approval-tab'}
            onClick={() => selectTab('orders')}
          >
            Pedidos de proveedores ({orders.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'products'}
            className={activeTab === 'products' ? 'approval-tab active' : 'approval-tab'}
            onClick={() => selectTab('products')}
          >
            Productos ({productRequests.length})
          </button>
        </div>

        {error && <p className="status error" role="alert">{error}</p>}
        {notice && <p className="status success" role="status">{notice}</p>}

        {activeTab === 'sales' ? <ShopOrders token={token} admin/> : loading ? (
          <p className="admin-message" role="status">Cargando solicitudes...</p>
        ) : activeTab === 'users' && users.length === 0 ? (
          <p className="admin-message">No hay cuentas pendientes de autorización.</p>
        ) : activeTab === 'orders' && orders.length === 0 ? (
          <p className="admin-message">No hay pedidos pendientes de aprobación.</p>
        ) : activeTab === 'products' && productRequests.length === 0 ? (
          <p className="admin-message">No hay solicitudes de productos pendientes.</p>
        ) : (
          <div className="table-scroll">
            <table className="pending-table">
              <thead>
                {activeTab === 'users' ? (
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Email</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Acciones</th>
                  </tr>
                ) : activeTab === 'orders' ? (
                  <tr>
                    <th scope="col">Proveedor</th>
                    <th scope="col">Producto</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Acciones</th>
                  </tr>
                ) : (
                  <tr>
                    <th scope="col">Solicitante</th>
                    <th scope="col">Acción</th>
                    <th scope="col">Producto</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Acciones</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {activeTab === 'users' ? users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Nombre">{user.name}</td>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Rol">
                      <span className={roleBadgeClass(user.role)}>{roleLabel(user.role)}</span>
                    </td>
                    <td data-label="Acciones">
                      <div className="admin-actions">
                        <button type="button" className="approve-btn" disabled={busyId !== null} onClick={() => updateStatus(user, 'aprobado')}>
                          {busyId === user.id ? 'Guardando...' : 'Aprobar'}
                        </button>
                        <button type="button" className="reject-btn" disabled={busyId !== null} onClick={() => updateStatus(user, 'rechazado')}>
                          Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : activeTab === 'orders' ? orders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Proveedor">
                      {order.provider_name}<br />
                      <span className="table-secondary">{order.provider_email}</span>
                    </td>
                    <td data-label="Producto">
                      <div className="order-product-cell">
                        <ProductImage src={order.product_image_url} alt={order.product_name} className="" emptyClassName="order-mini-image-empty" />
                        <span>{order.product_name}</span>
                      </div>
                    </td>
                    <td data-label="Cantidad">{order.quantity}</td>
                    <td data-label="Fecha">{orderDate.format(new Date(order.created_at))}</td>
                    <td data-label="Acciones">
                      <div className="admin-actions">
                        <button type="button" className="approve-btn" disabled={busyId !== null} onClick={() => updateStatus(order, 'aprobado')}>
                          {busyId === order.id ? 'Guardando...' : 'Aprobar'}
                        </button>
                        <button type="button" className="reject-btn" disabled={busyId !== null} onClick={() => updateStatus(order, 'rechazado')}>
                          Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : productRequests.map((request) => (
                  <tr key={request.id}>
                    <td data-label="Solicitante">
                      {request.requester_name}<br />
                      <span className="table-secondary">{request.requester_email}</span>
                    </td>
                    <td data-label="Acción">{request.request_type === 'crear' ? 'Alta' : 'Eliminación'}</td>
                    <td data-label="Producto">
                      <strong>{request.product_data.nombre}</strong><br />
                      <span className="table-secondary">
                        {request.product_data.categoria} · {currency.format(Number(request.product_data.precio))}
                      </span>
                    </td>
                    <td data-label="Fecha">{orderDate.format(new Date(request.created_at))}</td>
                    <td data-label="Acciones">
                      <div className="admin-actions">
                        <button type="button" className="approve-btn" disabled={busyId !== null} onClick={() => updateStatus(request, 'aprobado')}>
                          {busyId === request.id ? 'Guardando...' : 'Aprobar'}
                        </button>
                        <button type="button" className="reject-btn" disabled={busyId !== null} onClick={() => updateStatus(request, 'rechazado')}>
                          Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab !== 'sales' && !loading && error && (
          <button type="button" className="secondary-btn retry-btn" onClick={() => setRefreshKey((key) => key + 1)}>
            Reintentar
          </button>
        )}
        {activeTab === 'products' && (
          <div className="admin-return-row">
            <button type="button" className="secondary-btn" onClick={onBack}>
              Volver al catálogo
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

export default SuperAdminPanel
