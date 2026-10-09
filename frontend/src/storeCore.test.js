import test from 'node:test'
import assert from 'node:assert/strict'
import {createStore} from './application/store.js'
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}}
test('checkout preserves its idempotency key after failure and clears it after success with memory ports',async()=>{
  const requestStorage=memory(),cartStorage=memory(),keys=[]
  let fail=true,next=0
  const store=createStore({gateway:{checkout:async body=>{keys.push(body.request_key);if(fail)throw new Error('Network unavailable');return {id:1}}},cartStorage,requestStorage,idGenerator:{next:()=>`key-${++next}`}})
  const body={items:[{product_id:1,quantity:2}],address:{street:'One'},payment_method:'contra_entrega'}
  await assert.rejects(store.checkout(body,{}),/Network unavailable/)
  fail=false
  assert.equal((await store.checkout(body,{})).id,1)
  assert.deepEqual(keys,['key-1','key-1'])
  assert.equal(requestStorage.getItem('pendingCheckout'),null)
  await store.checkout({...body,items:[{product_id:1,quantity:1}]},{})
  assert.equal(keys[2],'key-2')
})
test('cart rules work without a browser and reject overstock',()=>{
  const store=createStore({gateway:{},cartStorage:memory(),requestStorage:memory(),idGenerator:{next:()=>''}})
  const product={id:1,stock:1,precio:'10.00'}
  const cart=store.addProduct([],product)
  assert.throws(()=>store.addProduct(cart,product),/stock/)
  store.saveCart(cart);assert.deepEqual(store.loadCart(),cart)
  assert.equal(store.estimateCart(cart,[product],{shipping_fee_cents:100,free_shipping_cents:2000}).subtotal,1000)
})
