export class FetchGateway {
  async request(path,{token,method='GET',body,signal}={}){
    const response=await fetch(path,{method,signal,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
    const data=await response.json().catch(()=>({}))
    if(!response.ok)throw new Error(response.status===401&&token?'Tu sesión terminó. Cierra sesión y vuelve a entrar.':data.message||'No se pudo completar la solicitud.')
    return {data,pending:response.status===202}
  }
}
