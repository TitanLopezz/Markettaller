import { useEffect, useState } from 'react'
import './App.css'
import ProductCatalog from './ProductCatalog'
import ProviderOrders from './ProviderOrders'
import SuperAdminPanel from './SuperAdminPanel'
import { getApiErrorMessage } from './apiError'
import { USERS_API_URL } from './api'

const emptyForm = { name: '', email: '', password: '', role: 'gestor' }
const roleLabel = (role) => role === 'proveedor' ? 'Proveedor' : role === 'super_admin' ? 'Super Admin' : 'Gestor de Productos'
const roleBadgeClass = (role) => role === 'proveedor'
  ? 'role-badge role-badge-provider'
  : role === 'super_admin'
    ? 'role-badge role-badge-admin'
    : 'role-badge role-badge-manager'

const loadSavedSession = () => {
  try {
    const token = window.sessionStorage.getItem('authToken')
    const user = JSON.parse(window.sessionStorage.getItem('authUser') || 'null')

    if (!token || !user?.role) {
      return { user: null, view: 'auth' }
    }

    const savedView = window.sessionStorage.getItem('currentView')
    const view = savedView === 'admin' && user.role === 'super_admin'
      ? 'admin'
      : savedView === 'orders' && user.role === 'proveedor'
        ? 'orders'
        : 'catalog'

    return { user, view }
  } catch {
    window.sessionStorage.removeItem('authToken')
    window.sessionStorage.removeItem('authUser')
    window.sessionStorage.removeItem('currentView')
    return { user: null, view: 'auth' }
  }
}

function App() {
  const [savedSession] = useState(loadSavedSession)
  const [mode, setMode] = useState(() => (
    window.sessionStorage.getItem('authMode') === 'login' ? 'login' : 'register'
  ))
  const [formData, setFormData] = useState(emptyForm)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [authenticatedUser, setAuthenticatedUser] = useState(savedSession.user)
  const [currentView, setCurrentView] = useState(savedSession.view)

  useEffect(() => {
    window.sessionStorage.setItem('authMode', mode)
  }, [mode])

  useEffect(() => {
    if (!authenticatedUser) {
      window.sessionStorage.removeItem('authToken')
      window.sessionStorage.removeItem('authUser')
      window.sessionStorage.removeItem('currentView')
      return
    }

    window.sessionStorage.setItem('authUser', JSON.stringify(authenticatedUser))
    window.sessionStorage.setItem('currentView', currentView)
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
      const response = await fetch(`${USERS_API_URL}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.message || 'No se pudo completar la solicitud.')
      }

      if (mode === 'register') {
        setFormData(emptyForm)
        setStatus({
          type: 'success',
          message: 'Registro recibido. Tu cuenta está pendiente de autorización.',
          accountRole: formData.role,
        })
      } else {
        window.sessionStorage.setItem('authToken', result.token)
        window.sessionStorage.setItem('authUser', JSON.stringify(result.user))
        window.sessionStorage.setItem('currentView', 'catalog')
        setAuthenticatedUser(result.user)
        setCurrentView('catalog')
      }
    } catch (error) {
      setStatus({ type: 'error', message: getApiErrorMessage(error, 'No se pudo completar la solicitud.') })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    window.sessionStorage.removeItem('authToken')
    window.sessionStorage.removeItem('authUser')
    window.sessionStorage.removeItem('currentView')
    window.sessionStorage.removeItem('adminApprovalTab')
    setAuthenticatedUser(null)
    setFormData(emptyForm)
    setStatus(null)
    setMode('login')
    setCurrentView('auth')
  }

  if (currentView === 'catalog' && authenticatedUser) {
    return (
      <ProductCatalog
        user={authenticatedUser}
        token={window.sessionStorage.getItem('authToken')}
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
        token={window.sessionStorage.getItem('authToken')}
        onBack={handleBackToCatalog}
        onLogout={handleLogout}
      />
    )
  }

  if (currentView === 'admin' && authenticatedUser?.role === 'super_admin') {
    return (
      <SuperAdminPanel
        token={window.sessionStorage.getItem('authToken')}
        onBack={handleBackToCatalog}
      />
    )
  }

  return (
    <main className="app-shell">
      <section className="card" aria-labelledby="auth-title">
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
                ? 'Solicita acceso para comenzar a trabajar en el portal.'
                : 'Ingresa con tu cuenta autorizada.'}
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
                  required
                />
              </label>

              {mode === 'register' && (
                <label>
                  Tipo de cuenta
                  <select name="role" value={formData.role} onChange={handleChange}>
                    <option value="gestor">Gestor de Productos</option>
                    <option value="proveedor">Proveedor</option>
                  </select>
                </label>
              )}

              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? 'Procesando...' : mode === 'register' ? 'Solicitar registro' : 'Entrar'}
              </button>
            </form>

            <p className="mode-switch">
              {mode === 'register' ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}
              <button type="button" onClick={changeMode}>
                {mode === 'register' ? 'Inicia sesión' : 'Regístrate'}
              </button>
            </p>
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
