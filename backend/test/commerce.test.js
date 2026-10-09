const test = require('node:test');
const assert = require('node:assert/strict');
const {checkoutInput,toCents,addressInput} = require('../src/domain/commerceInput');
const address = {recipient:'Ada',phone:'5512345678',street:'Calle Uno 123',district:'Centro',city:'Ciudad de México',state:'CDMX',postal_code:'06000'};
test('checkout validates quantities, addresses and payment methods, and ignores client totals',()=>{
  assert.equal(toCents('12.34'),1234);
  assert.equal(toCents('12.3'),1230);
  assert.equal(toCents('0.01'),1);
  const base={items:[{product_id:2,quantity:2},{product_id:1,quantity:1}],address,payment_method:'contra_entrega',request_key:'test-request-key-00001'};
  const data=checkoutInput({...base,total_cents:1,user_id:999});
  assert.deepEqual(data.items.map(i=>i.product_id),[1,2]);
  assert.equal(Object.hasOwn(data,'total_cents'),false);
  assert.deepEqual(checkoutInput({...base,items:[...base.items].reverse()}),data);
  for(const items of [[],[{product_id:1,quantity:0}],[{product_id:1,quantity:1.5}],[{product_id:1,quantity:101}],[{product_id:1,quantity:1},{product_id:1,quantity:1}]]) assert.throws(()=>checkoutInput({...base,items}),{code: 'VALIDATION'});
  assert.throws(()=>checkoutInput({...base,payment_method:'tarjeta'}),{code: 'VALIDATION'});
  assert.throws(()=>addressInput({...address,postal_code:'ABC'}),{code: 'VALIDATION'});
  assert.throws(()=>toCents('1.001'),{code: 'CONFLICT'});
});
