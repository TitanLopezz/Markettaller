import {useState} from 'react'
import {store} from '../bootstrap/services.js'

export default function PasswordRecovery({token,onBack}) {
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [message,setMessage] = useState('')
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault();setError('');setBusy(true)
    try{const result=await (token?store.resetPassword({token,password}):store.forgotPassword({email}));setMessage(result.message)}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <main className="app-shell"><section className="card"><h1>{token?'Nueva contraseña':'Recupera tu cuenta'}</h1>
    {!message&&<form className="user-form" onSubmit={submit}>{token?<label>Nueva contraseña<input type="password" minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>:<label>Correo electrónico<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>}<button className="primary-btn" disabled={busy}>{busy?'Procesando…':token?'Guardar contraseña':'Enviar enlace'}</button></form>}
    {error&&<p className="status error" role="alert">{error}</p>}{message&&<p className="status success" role="status">{message}</p>}
    <button className="secondary-btn" onClick={onBack}>Volver al acceso</button>
  </section></main>
}
