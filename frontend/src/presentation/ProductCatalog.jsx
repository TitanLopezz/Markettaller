import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../apiError'
import {portal} from '../bootstrap/services.js'
import ProductImage from './ProductImage'
import { isWebImageUrl, normalizeImageUrl, validateImageUrl } from '../imageUrl'

const EMPTY_PRODUCT = {
  nombre: '',
  descripcion: '',
  precio: '',
  categoria: '',
  imagen_url: '',
  stock: '0',
}
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

function roleKey(role) {
  return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function ProductCatalog({ user, token, onLogout, onManageRequests, onViewOrders, onShop, onSales }) {
  const role = roleKey(user?.role)
  const canManageProducts = ['gestor', 'gestor_de_productos', 'super_admin'].includes(role)
  const isSuperAdmin = role === 'super_admin'
  const isProvider = role === 'proveedor'
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [orderProduct, setOrderProduct] = useState(null)
  const [orderQuantity, setOrderQuantity] = useState('1')
  const [submittingOrder, setSubmittingOrder] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const loadProducts = async () => {
      setLoading(true)
      setError('')

      try {
        const result=await portal.products({token,signal:controller.signal})

        setProducts(Array.isArray(result) ? result : [])
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(getApiErrorMessage(requestError, 'No se pudo cargar el catálogo.'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadProducts()
    return () => controller.abort()
  }, [token, reloadKey])

  const updateField = (event) => {
    const { name, value } = event.target
    if (name === 'imagen_url') {
      setImagePreviewFailed(false)
    }
    setForm((current) => ({ ...current, [name]: value }))
  }

  const resetForm = () => {
    setForm(EMPTY_PRODUCT)
    setImagePreviewFailed(false)
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (product) => {
    setImagePreviewFailed(false)
    setForm({
      nombre: product.nombre,
      descripcion: product.descripcion || '',
      precio: String(product.precio),
      categoria: product.categoria,
      imagen_url: product.imagen_url || '',
      stock: String(product.stock),
    })
    setEditingId(product.id)
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const imagenUrl = await validateImageUrl(form.imagen_url)
      const result=await portal.saveProduct(editingId,{...form,imagen_url:imagenUrl,precio:Number(form.precio),stock:Number(form.stock)},{token})

      if (result.pending) {
        setNotice(result.message || 'Solicitud enviada al Super Admin para aprobación.')
        resetForm()
        return
      }

      const savedProduct = result.product
      setProducts((current) => editingId
        ? current.map((product) => product.id === editingId ? savedProduct : product)
        : [...current, savedProduct])
      setNotice(editingId ? 'Producto actualizado.' : 'Producto agregado.')
      resetForm()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No se pudo guardar el producto.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (product) => {
    if (!window.confirm(`¿Eliminar ${product.nombre}?`)) {
      return
    }

    setBusyId(product.id)
    setError('')
    setNotice('')

    try {
      const result=await portal.deleteProduct(product.id,{token})

      if (result.pending) {
        setNotice(result.message || 'Solicitud de eliminación enviada al Super Admin.')
        return
      }

      setProducts((current) => current.filter((item) => item.id !== product.id))
      setNotice('Producto eliminado.')
      if (editingId === product.id) {
        resetForm()
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No se pudo eliminar el producto.'))
    } finally {
      setBusyId(null)
    }
  }

  const submitOrder = async (event) => {
    event.preventDefault()
    setSubmittingOrder(true)
    setError('')
    setNotice('')

    try {
      await portal.createProviderOrder({product_id:orderProduct.id,quantity:Number(orderQuantity)},{token})

      setNotice(`Solicitud de ${orderProduct.nombre} enviada para aprobación.`)
      setOrderProduct(null)
      setOrderQuantity('1')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No se pudo enviar la solicitud.'))
    } finally {
      setSubmittingOrder(false)
    }
  }

  return (
    <main className="app-shell catalog-shell">
      <section className="catalog-layout" aria-labelledby="catalog-title">
        <header className="catalog-header">
          <div>
            <p className="eyebrow">CATÁLOGO DE PRODUCTOS</p>
            <h1 id="catalog-title">Productos</h1>
            <p className="catalog-user">{user?.name} · {user?.email}</p>
          </div>
          <nav className="catalog-nav" aria-label="Acciones de cuenta">
            <button type="button" className="secondary-btn" onClick={onShop}>Ver tienda</button>
            {canManageProducts && <button type="button" className="primary-btn" onClick={onSales}>{isSuperAdmin?'Ventas y entregas':'Compras y despachos'}</button>}
            {isSuperAdmin && (
              <button type="button" className="secondary-btn" onClick={onManageRequests}>
                Panel Super Admin
              </button>
            )}
            {isProvider && (
              <button type="button" className="secondary-btn" onClick={onViewOrders}>
                Mis solicitudes
              </button>
            )}
            <button type="button" className="secondary-btn" onClick={onLogout}>
              Cerrar sesión
            </button>
          </nav>
        </header>

        <div className="catalog-toolbar">
          <p>{loading ? 'Cargando...' : `${products.length} productos`}</p>
          {canManageProducts && (
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                setEditingId(null)
                setForm(EMPTY_PRODUCT)
                setShowForm((current) => !current)
                setError('')
              }}
            >
              {showForm && !editingId ? 'Cancelar' : 'Agregar producto'}
            </button>
          )}
        </div>

        {error && <p className="status error" role="alert">{error}</p>}
        {notice && <p className="status success" role="status">{notice}</p>}

        {showForm && canManageProducts && (
          <form className="product-form" onSubmit={handleSubmit}>
            <div className="product-form-heading">
              <h2>{editingId ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button type="button" className="secondary-btn" onClick={resetForm}>Cancelar</button>
            </div>
            <label>
              Nombre
              <input name="nombre" value={form.nombre} onChange={updateField} maxLength="160" required />
            </label>
            <label>
              Descripción
              <textarea name="descripcion" value={form.descripcion} onChange={updateField} rows="3" />
            </label>
            <div className="product-form-grid">
              <label>
                Precio (MXN)
                <input name="precio" type="number" min="0" step="0.01" value={form.precio} onChange={updateField} required />
              </label>
              <label>
                Stock
                <input name="stock" type="number" min="0" step="1" value={form.stock} onChange={updateField} required />
              </label>
              <label>
                Categoría
                <input name="categoria" value={form.categoria} onChange={updateField} maxLength="100" required />
              </label>
              <label>
                URL de imagen
                <input name="imagen_url" type="url" value={form.imagen_url} onChange={updateField} />
                <small>Pega el enlace directo de la foto. Los enlaces de Google Imágenes se convierten automáticamente.</small>
              </label>
            </div>
            {form.imagen_url.trim() && (
              <div className="product-form-preview">
                {imagePreviewFailed || !isWebImageUrl(form.imagen_url.trim()) ? (
                  <p className="product-form-preview-error" role="status">
                    {imagePreviewFailed
                      ? 'No se pudo cargar la imagen desde esa URL.'
                      : 'La URL de imagen debe comenzar con http:// o https://.'}
                  </p>
                ) : (
                  <img
                    className="product-form-image-preview"
                    src={normalizeImageUrl(form.imagen_url)}
                    referrerPolicy="no-referrer"
                    alt={form.nombre ? `Vista previa: ${form.nombre}` : 'Vista previa del producto'}
                    onError={() => setImagePreviewFailed(true)}
                  />
                )}
              </div>
            )}
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="catalog-empty" role="status">Cargando catálogo...</p>
        ) : products.length === 0 ? (
          <p className="catalog-empty">Todavía no hay productos.</p>
        ) : (
          <div className="product-grid">
            {products.map((product) => {
              return (
                <article className="product-card" key={product.id}>
                  <ProductImage src={product.imagen_url} alt={product.nombre} />
                <div className="product-card-body">
                  <p className="product-category">{product.categoria}</p>
                  <h2>{product.nombre}</h2>
                  {product.descripcion && <p className="product-description">{product.descripcion}</p>}
                  <div className="product-meta">
                    <strong>{currency.format(Number(product.precio))}</strong>
                    <span>Stock: {product.stock}</span>
                  </div>
                  {canManageProducts && (
                    <div className="product-actions">
                      <button type="button" className="secondary-btn" onClick={() => startEdit(product)}>Editar</button>
                      <button
                        type="button"
                        className="reject-btn"
                        disabled={busyId === product.id}
                        onClick={() => handleDelete(product)}
                      >
                        {busyId === product.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  )}
                  {isProvider && (
                    <button type="button" className="primary-btn" onClick={() => setOrderProduct(product)}>
                      Solicitar producto
                    </button>
                  )}
                </div>
                </article>
              )
            })}
          </div>
        )}

        {error && !loading && (
          <button type="button" className="secondary-btn retry-btn" onClick={() => setReloadKey((key) => key + 1)}>
            Reintentar
          </button>
        )}
      </section>
      {orderProduct && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !submittingOrder) {
            setOrderProduct(null)
          }
        }}>
          <section className="request-dialog" role="dialog" aria-modal="true" aria-labelledby="request-title">
            <p className="eyebrow">SOLICITUD DE PROVEEDOR</p>
            <h2 id="request-title">{orderProduct.nombre}</h2>
            <p className="request-copy">
              La solicitud quedará pendiente de aprobación. Stock disponible: {orderProduct.stock}.
              Se descontará al aprobar y la disponibilidad puede cambiar antes de la revisión.
            </p>
            <form className="user-form" onSubmit={submitOrder}>
              <label>
                Cantidad
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={orderQuantity}
                  onChange={(event) => setOrderQuantity(event.target.value)}
                  required
                />
              </label>
              <div className="request-actions">
                <button type="button" className="secondary-btn" disabled={submittingOrder} onClick={() => setOrderProduct(null)}>
                  Cancelar
                </button>
                <button type="submit" className="primary-btn" disabled={submittingOrder}>
                  {submittingOrder ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default ProductCatalog
