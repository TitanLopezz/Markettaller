const test=require('node:test');
const assert=require('node:assert/strict');
const {createCommerceUseCases}=require('../src/application/use-cases/commerce');
const {orderChanges,assertFulfillmentChanges}=require('../src/domain/shopOrder');
const address={recipient:'Ada',phone:'5512345678',street:'Calle 1',district:'Centro',city:'CDMX',state:'CDMX',postal_code:'06000'};
const createMemoryShop=()=>{
  let state={products:{1:{id:1,nombre:'Uno',imagen_url:null,precio:'12.34',stock:3}},orders:[],items:[],notifications:[]};
  const repo={
    findUser:async()=>({id:1,role:'cliente',status:'aprobado',email:'test@example.test'}),
    findRequest:async(userId,key)=>state.orders.find(o=>o.user_id===userId&&o.request_key===key)||null,
    lockProduct:async id=>state.products[id]||null,
    insertOrder:async(userId,data,subtotal,shipping)=>{const id=state.orders.length+1;state.orders.push({id,user_id:userId,...data,subtotal_cents:subtotal,shipping_cents:shipping,total_cents:subtotal+shipping,status:'recibido',payment_status:'pendiente'});return id;},
    changeStock:async(id,delta)=>{state.products[id].stock+=delta;},
    insertItem:async(id,item)=>state.items.push({...item,order_id:id}),notify:async(...args)=>state.notifications.push(args),
    findOrder:async id=>state.orders.find(o=>o.id===id),lockOrder:async id=>state.orders.find(o=>o.id===id),
    orderItems:async id=>state.items.filter(i=>i.order_id===id),fulfillment:async()=>null,
    updateOrder:async(id,changes)=>Object.assign(state.orders.find(o=>o.id===id),changes),
  };
  const unitOfWork={run:async work=>{const before=structuredClone(state);try{return await work({commerce:repo});}catch(error){state=before;throw error;}}};
  const service=createCommerceUseCases({repository:repo,unitOfWork,crypto:{hash:value=>value},passwordHasher:{},mailer:{send:async()=>true},clock:{now:()=>new Date()},logger:{error:()=>{}},config:{payment_methods:['contra_entrega'],free_shipping_cents:5000,shipping_fee_cents:100}});
  return {service,state:()=>state};
};
test('checkout and cancellation work with memory ports, without Postgres, Express or real email',async()=>{
  const {service,state}=createMemoryShop();
  const body={items:[{product_id:1,quantity:2}],address,payment_method:'contra_entrega',request_key:'memory-request-key-001'};
  const order=await service.checkout(1,body);
  assert.equal(order.total_cents,2568);assert.equal(state().products[1].stock,1);
  assert.equal((await service.checkout(1,body)).id,order.id);assert.equal(state().products[1].stock,1);
  await assert.rejects(service.checkout(1,{...body,request_key:'memory-request-key-002'}),{code:'CONFLICT'});
  assert.equal(state().orders.length,1);
  await service.updateOrder(order.id,1,{status:'cancelado'},false);assert.equal(state().products[1].stock,3);
  await assert.rejects(service.updateOrder(order.id,1,{status:'cancelado'},false),{code:'CONFLICT'});assert.equal(state().products[1].stock,3);
});
test('shipping and manager permissions are pure domain rules',()=>{
  assert.throws(()=>assertFulfillmentChanges({payment_status:'pagado'}),{code:'FORBIDDEN'});
  assert.throws(()=>orderChanges({status:'preparando',payment_status:'pendiente',payment_method:'transferencia'},{status:'enviado',carrier:'Paquetería',tracking_number:'123'},true,true),{code:'CONFLICT'});
  const changes=orderChanges({status:'preparando',payment_status:'pagado',payment_method:'transferencia'},{status:'enviado',carrier:'Paquetería',tracking_number:'123'},true,true);
  assert.equal(changes.status,'enviado');
});
