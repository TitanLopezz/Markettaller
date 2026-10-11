import { useEffect, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts'
import { analytics } from '../bootstrap/services.js'
import './DashboardAdmin.css'
const money = value => new Intl.NumberFormat('es-MX', {style:'currency',currency:'MXN'}).format(value)
const colors = ['#e76f51','#2a9d8f','#457b9d','#e9c46a']

export function TemporalFilter({filter,onChange}) {
  return <div className="analytics-filters">
    <label>Periodo<select value={filter.period} onChange={e=>onChange({period:e.target.value,top:filter.top})}>
      <option value="daily">Hoy</option><option value="weekly">Últimos 7 días</option><option value="monthly">Este mes</option><option value="custom">Rango personalizado</option>
    </select></label>
    {filter.period==='custom' && <><label>Desde<input type="date" value={filter.startDate||''} onChange={e=>onChange({...filter,startDate:e.target.value})}/></label><label>Hasta<input type="date" min={filter.startDate} value={filter.endDate||''} onChange={e=>onChange({...filter,endDate:e.target.value})}/></label></>}
    <label>Ranking<select value={filter.top} onChange={e=>onChange({...filter,top:e.target.value})}><option value="5">Top 5</option><option value="10">Top 10</option></select></label>
  </div>
}

export default function DashboardAdmin({user,token,onBack}) {
  const [filter,setFilter] = useState({period:'weekly',top:'5'})
  const [data,setData] = useState(null)
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(true)
  const [sort,setSort] = useState({key:'units',direction:-1})
  const [search,setSearch] = useState('')
  const [reload,setReload] = useState(0)
  const allowed = user?.role==='super_admin'
  useEffect(()=>{
    if (!allowed || (filter.period==='custom' && (!filter.startDate || !filter.endDate))) return
    const controller = new AbortController()
    analytics.dashboard(filter,{token,signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setData(result)}).catch(err=>{if(!controller.signal.aborted)setError(err.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return ()=>controller.abort()
  },[filter,token,allowed,reload])
  if (!allowed) return <main><p role="alert">Acceso exclusivo para administradores.</p></main>
  const rows = (data?.topProducts||[]).filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort.direction*(sort.key==='name'?a.name.localeCompare(b.name):a[sort.key]-b[sort.key]))
  const changeSort = key => setSort(current=>({key,direction:current.key===key?-current.direction:-1}))
  return <main className="analytics-shell">
    <button className="secondary-btn" onClick={onBack}>Volver al portal</button>
    <p className="eyebrow">ANALÍTICA DE LA TIENDA</p><h1>Dashboard de administración</h1>
    <p>Ventas pagadas, productos y pedidos · MXN · Fechas en UTC</p>
    <TemporalFilter filter={filter} onChange={value=>{setData(null);setError('');setLoading(value.period!=='custom'||Boolean(value.startDate&&value.endDate));setFilter(value)}}/>
    {filter.period==='custom' && (!filter.startDate || !filter.endDate) && <p>Selecciona ambas fechas para consultar.</p>}
    {loading && <p role="status">Consultando métricas…</p>}
    {error && <div role="alert"><p>{error}</p><button onClick={()=>{setLoading(true);setError('');setData(null);setReload(reload+1)}}>Reintentar</button></div>}
    {data && <>
      <p>{data.range.startDate} al {data.range.endDate}</p>
      <div className="analytics-kpis">{[['Ingresos totales',money(data.summary.totalRevenue)],['Ticket por pedido',money(data.summary.averageOrder)],['Gasto por usuario',money(data.summary.averageUser)],['Pedidos pagados',data.summary.paidOrders],['Usuarios compradores',data.summary.customers]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <div className="analytics-charts">
        <section><h2>Tendencia de ingresos</h2><ResponsiveContainer width="100%" height={300}><LineChart data={data.trend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={money}/><Line type="monotone" dataKey="revenue" name="Ingresos" stroke="#2a9d8f" strokeWidth={3}/></LineChart></ResponsiveContainer></section>
        <section><h2>Estado de pedidos</h2>{data.orderStates.some(s=>s.count>0)?<ResponsiveContainer width="100%" height={300}><PieChart><Pie data={data.orderStates} dataKey="count" nameKey="state" cx="50%" cy="45%" outerRadius={90}>{data.orderStates.map((s,i)=><Cell key={s.state} fill={colors[i]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer>:<p>No hay pedidos en este periodo.</p>}<ul>{data.orderStates.map(s=><li key={s.state}>{s.state}: {s.count} ({s.percentage}%)</li>)}</ul></section>
      </div>
      <section className="analytics-ranking"><h2>Productos más vendidos</h2><label>Buscar en el ranking<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <div className="analytics-table"><table><thead><tr>{[['name','Producto'],['units','Unidades'],['revenue','Ingresos']].map(([key,label])=><th key={key} aria-sort={sort.key===key?(sort.direction===1?'ascending':'descending'):'none'}><button onClick={()=>changeSort(key)}>{label} {sort.key===key?(sort.direction===1?'↑':'↓'):''}</button></th>)}</tr></thead><tbody>{rows.map((p,i)=><tr key={`${p.productId}-${p.name}-${i}`}><td>{p.name}</td><td>{p.units}</td><td>{money(p.revenue)}</td></tr>)}</tbody></table></div>
        {!rows.length && <p>No hay productos que mostrar.</p>}
      </section>
    </>}
  </main>
}
