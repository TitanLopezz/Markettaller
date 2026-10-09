import { useEffect, useState } from 'react'
import './App.css'
import ProductCatalog from './ProductCatalog'
import ProviderOrders from './ProviderOrders'
import SuperAdminPanel from './SuperAdminPanel'
import { getApiErrorMessage } from '../apiError'
import {portal,session} from '../bootstrap/services.js'
import Storefront from './Storefront'
import ShopOrders from './ShopOrders'
import PasswordRecovery from './PasswordRecovery'

const emptyForm = { name: '', email: '', password: '', role: 'cliente' }
const roleLabel = (role) => role === 'cliente' ? 'Cliente' : role === 'proveedor' ? 'Proveedor' : role === 'super_admin' ? 'Super Admin' : 'Gestor de Productos'
const roleBadgeClass = (role) => role === 'proveedor'
  ? 'role-badge role-badge-provider'
  : role === 'super_admin'
    ? 'role-badge role-badge-admin'
    : 'role-badge role-badge-manager'

const loadSavedSession = () => {
  try {
    const token = session.getItem('authToken')
    const user = JSON.parse(session.getItem('authUser') || 'null')

    if (!token || !user?.role) {
      return { user: null, view: 'shop' }
    }

    const savedView = session.getItem('currentView')
    const view = user.role === 'cliente' || savedView === 'shop' ? 'shop' : savedView === 'sales' && ['super_admin','gestor'].includes(user.role) ? 'sales' : savedView === 'admin' && user.role === 'super_admin'
      ? 'admin'
      : savedView === 'orders' && user.role === 'proveedor'
        ? 'orders'
        : 'catalog'

    return { user, view }
  } catch {
    session.removeItem('authToken')
    session.removeItem('authUser')
    session.removeItem('currentView')
    return { user: null, view: 'shop' }
  }
}

function App() {
  const [savedSession] = useState(loadSavedSession)
  const [mode, setMode] = useState(() => (
    session.getItem('authMode') === 'login' ? 'login' : 'register'
  ))
  const [formData, setFormData] = useState(emptyForm)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [authenticatedUser, setAuthenticatedUser] = useState(savedSession.user)
  const [currentView, setCurrentView] = useState(savedSession.view)
  const [resetToken,setResetToken] = useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('reset'))
  const [recovering,setRecovering] = useState(Boolean(resetToken))
  useEffect(()=>{if(resetToken)window.history.replaceState(null,'',window.location.pathname+window.location.search)},[resetToken])

  useEffect(() => {
    session.setItem('authMode', mode)
  }, [mode])

  useEffect(() => {
    if (!authenticatedUser) {
      session.removeItem('authToken')
      session.removeItem('authUser')
      session.removeItem('currentView')
      return
    }

    session.setItem('authUser', JSON.stringify(authenticatedUser))
    session.setItem('currentView', currentView)
  }, [authenticatedUser, currentView])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const changeMode = () => {
    setMode((current) => (current === 'register' ? 'login' : 'register'))
    setFormData(emptyForm)
    setStatus(null)
  }

  const handleBackToCatalog = () => {
    window.scrollTo({ top: 0, left: 0 })
    setCurrentView('catalog')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setStatus(null)

    try {
      const action = mode === 'register' ? 'register' : 'login'
      const result=await portal.account(action,formData)

      if (mode === 'register') {
        setFormData(emptyForm)
        setStatus({
          type: 'success',
          message: result.message,
          accountRole: formData.role,
        })
      } else {
        session.setItem('authToken', result.token)
        session.setItem('authUser', JSON.stringify(result.user))
        session.setItem('currentView', result.user.role === 'cliente' ? 'shop' : 'catalog')
        setAuthenticatedUser(result.user)
        setCurrentView(result.user.role === 'cliente' ? 'shop' : 'catalog')
      }
    } catch (error) {
      setStatus({ type: 'error', message: getApiErrorMessage(error, 'No se pudo completar la solicitud.') })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    session.removeItem('authToken')
    session.removeItem('authUser')
    session.removeItem('currentView')
    session.removeItem('adminApprovalTab')
    setAuthenticatedUser(null)
    setFormData(emptyForm)
    setStatus(null)
    setMode('login')
    setCurrentView('shop')
  }

  if (recovering) return <PasswordRecovery token={resetToken} onBack={()=>{setResetToken(null);setRecovering(false);setMode('login');setCurrentView('auth')}}/>
  if (currentView === 'shop') return <Storefront user={authenticatedUser} token={session.getItem('authToken')} onLogin={()=>{setMode('login');setCurrentView('auth')}} onLogout={handleLogout} onPortal={()=>setCurrentView('catalog')}/>
  if (currentView === 'sales' && ['super_admin','gestor'].includes(authenticatedUser?.role)) return <main className="store-shell"><button className="secondary-btn no-print" onClick={handleBackToCatalog}>Volver al portal</button><ShopOrders token={session.getItem('authToken')} admin={authenticatedUser.role==='super_admin'} manager={authenticatedUser.role==='gestor'}/></main>

  if (currentView === 'catalog' && authenticatedUser) {
    return (
      <ProductCatalog
        onShop={()=>setCurrentView('shop')}
        onSales={()=>setCurrentView('sales')}
        user={authenticatedUser}
        token={session.getItem('authToken')}
        onLogout={handleLogout}
        onManageRequests={() => {
          window.scrollTo({ top: 0, left: 0 })
          setCurrentView('admin')
        }}
        onViewOrders={() => {
          window.scrollTo({ top: 0, left: 0 })
          setCurrentView('orders')
        }}
      />
    )
  }

  if (currentView === 'orders' && authenticatedUser?.role === 'proveedor') {
    return (
      <ProviderOrders
        user={authenticatedUser}
        token={session.getItem('authToken')}
        onBack={handleBackToCatalog}
        onLogout={handleLogout}
      />
    )
  }

  if (currentView === 'admin' && authenticatedUser?.role === 'super_admin') {
    return (
      <SuperAdminPanel
        token={session.getItem('authToken')}
        onBack={handleBackToCatalog}
      />
    )
  }

  return (
    <main className="app-shell">
      <section className="card" aria-labelledby="auth-title">
        <button className="secondary-btn" onClick={()=>setCurrentView('shop')}>Explorar la tienda</button>
        <p className="eyebrow">PORTAL DE CUENTAS</p>
        <h1 id="auth-title">{authenticatedUser ? 'Acceso confirmado' : mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}</h1>

        {authenticatedUser ? (
          <div className="account-summary">
            <p>{authenticatedUser.email}</p>
            <p>Rol: <span className={roleBadgeClass(authenticatedUser.role)}>{roleLabel(authenticatedUser.role)}</span></p>
            <button type="button" className="secondary-btn" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        ) : (
          <>
            <p className="form-intro">
              {mode === 'register'
                ? 'Crea una cuenta de cliente para comprar. Las cuentas de gestión requieren autorización.'
                : 'Ingresa con tu cuenta.'}
            </p>

            <form className="user-form" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <label>
                  Nombre completo
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    autoComplete="name"
                    required
                  />
                </label>
              )}

              <label>
                Correo electrónico
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Contraseña
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  minLength={mode === 'register' ? 8 : undefined}
                  required
                />
              </label>

              {mode === 'register' && (
                <label>
                  Tipo de cuenta
                  <select name="role" value={formData.role} onChange={handleChange}>
                    <option value="cliente">Cliente</option>
                    <option value="gestor">Gestor de Productos</option>
                    <option value="proveedor">Proveedor</option>
                  </select>
                </label>
              )}

              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? 'Procesando...' : mode === 'register' ? formData.role === 'cliente' ? 'Crear cuenta' : 'Solicitar registro' : 'Entrar'}
              </button>
            </form>

            <p className="mode-switch">
              {mode === 'register' ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}
              <button type="button" onClick={changeMode}>
                {mode === 'register' ? 'Inicia sesión' : 'Regístrate'}
              </button>
            </p>
            {mode === 'login' && <button className="secondary-btn" onClick={()=>setRecovering(true)}>Olvidé mi contraseña</button>}
          </>
        )}

        {status && (
          <p className={`status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
            {status.message}
            {status.accountRole && (
              <span className={roleBadgeClass(status.accountRole)}>{roleLabel(status.accountRole)}</span>
            )}
          </p>
        )}
      </section>
    </main>
  )
}

export default App
