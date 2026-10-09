const {fail}=require('./errors');
const transitions={recibido:['confirmado','cancelado'],confirmado:['preparando','cancelado'],preparando:['enviado','cancelado'],enviado:['entregado'],entregado:[],cancelado:[]};
const orderChanges=(order,input,staff,hasInstructions)=>{
  if(!staff&&(input.status!=='cancelado'||!['recibido','confirmado'].includes(order.status)))throw fail('El pedido ya no puede cancelarse desde tu cuenta.','CONFLICT');
  const status=input.status||order.status;
  const payment=staff?(input.payment_status||order.payment_status):order.payment_status;
  if(!['pendiente','pagado','reembolsado'].includes(payment))throw fail('Estado de pago inválido.');
  if(payment!==order.payment_status&&!((order.payment_status==='pendiente'&&payment==='pagado')||(order.payment_status==='pagado'&&payment==='reembolsado')))throw fail('Transición de pago inválida.','CONFLICT');
  if(['cancelado','entregado'].includes(order.status))throw fail('Este pedido ya está cerrado.','CONFLICT');
  if(status!==order.status&&!transitions[order.status].includes(status))throw fail('Transición de pedido inválida.','CONFLICT');
  if(status==='cancelado'&&payment==='pagado')throw fail('Registra el reembolso antes de cancelar el pedido.','CONFLICT');
  if(payment==='reembolsado'&&status!=='cancelado')throw fail('Un reembolso debe acompañar la cancelación del pedido.','CONFLICT');
  if(status==='entregado'&&payment!=='pagado')throw fail('Confirma el pago antes de completar la entrega.','CONFLICT');
  if(status==='enviado'&&order.payment_method==='transferencia'&&payment!=='pagado')throw fail('Confirma la transferencia antes de enviar.','CONFLICT');
  const carrier=input.carrier===undefined?order.carrier:input.carrier;
  const tracking_number=input.tracking_number===undefined?order.tracking_number:input.tracking_number;
  if(status==='enviado'&&(!carrier||!tracking_number))throw fail('Indica transportista y número de guía.');
  if(status==='enviado'&&!hasInstructions)throw fail('Guarda las instrucciones de preparación y envío antes de despachar.');
  return {status,payment_status:payment,carrier,tracking_number};
};
const assertFulfillmentChanges=input=>{
  if(!input||Object.keys(input).some(key=>!['status','carrier','tracking_number'].includes(key))||(input.status&&!['confirmado','preparando','enviado','entregado'].includes(input.status)))throw fail('El gestor puede coordinar preparación y entrega; pagos, reembolsos y cancelaciones corresponden al Super Admin.','FORBIDDEN');
};
module.exports={orderChanges,assertFulfillmentChanges};
