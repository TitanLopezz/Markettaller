const test = require('node:test');
const assert = require('node:assert/strict');
const {NodemailAdapter} = require('../src/infrastructure/adapters/NodemailAdapter');
const {CreateOrderUseCase} = require('../src/application/use-cases/CreateOrderUseCase');
const order = {id:7,customer:{name:'Ana <script>',email:'ana@example.test'},items:[{product_name:'Libro & guía',quantity:2,unit_price_cents:15000}],subtotal_cents:30000,shipping_cents:9900,total_cents:39900,payment_method:'transferencia',transfer_instructions:'Banco de prueba\nCLABE: 000'};

test('SMTP recibe ambas plantillas, importes persistidos y HTML escapado', async () => {
  const messages=[];
  const adapter=new NodemailAdapter({transport:{async sendMail(message){messages.push(message);return {accepted:[message.to],rejected:[]};}},from:'tienda@example.test',adminEmail:'admin@example.test'});
  const useCase=new CreateOrderUseCase({emailService:adapter,logger:{error(){}}});
  assert.deepEqual(await useCase.notify(order),{customer:'accepted',admin:'accepted'});
  assert.equal(messages[0].to,order.customer.email);
  assert.equal(messages[1].to,'admin@example.test');
  assert.match(messages[0].text,/Pendiente de Pago/);
  assert.match(messages[0].text,/399/);
  assert.match(messages[0].text,/CLABE/);
  assert.match(messages[0].html,/Ana &lt;script&gt;/);
  assert.match(messages[0].html,/Libro &amp; guía/);
});
test('un fallo del cliente no impide la notificación administrativa', async () => {
  let adminSent=false;
  const useCase=new CreateOrderUseCase({emailService:{async sendOrderConfirmationEmail(){throw new Error('SMTP');},async sendAdminNewOrderNotification(){adminSent=true;return true;}},logger:{error(){}}});
  assert.deepEqual(await useCase.notify(order),{customer:'unavailable',admin:'accepted'});
  assert.equal(adminSent,true);
});
test('sin SMTP no se afirma un envío exitoso', async () => {
  const adapter=new NodemailAdapter({});
  assert.equal(await adapter.sendOrderConfirmationEmail(order),false);
});
test('envía después de guardar y omite correos para la clave repetida', async () => {
  const events=[];
  const useCase=new CreateOrderUseCase({emailService:{async sendOrderConfirmationEmail(){events.push('customer');return true;},async sendAdminNewOrderNotification(){events.push('admin');return true;}},logger:{error(){}}});
  const saveOrder=async()=>{events.push('commit');return {order:{...order,user_id:1},repeated:false};};
  await useCase.run({saveOrder,loadCustomer:async()=>order.customer,transferInstructions:order.transfer_instructions});
  assert.deepEqual(events,['commit','customer','admin']);
  events.length=0;
  await useCase.run({saveOrder:async()=>({order:{...order},repeated:true}),loadCustomer:async()=>{throw new Error('No debe consultarse');}});
  assert.deepEqual(events,[]);
});
