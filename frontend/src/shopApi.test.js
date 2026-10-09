import test from 'node:test'
import assert from 'node:assert/strict'
import {loadCart} from './shopApi.js'
import {FetchGateway} from './infrastructure/http/FetchGateway.js'
import {ShopGateway} from './infrastructure/http/ShopGateway.js'

test('cart storage rejects corrupt data, duplicates and invalid quantities',()=>{
  const previous=globalThis.localStorage
  try {
    globalThis.localStorage={getItem:()=>JSON.stringify([{product_id:1,quantity:2},{product_id:1,quantity:3},{product_id:2,quantity:-1},{product_id:3,quantity:101},{product_id:4,quantity:1,price:0}])}
    assert.deepEqual(loadCart(),[{product_id:1,quantity:2},{product_id:4,quantity:1}])
    globalThis.localStorage={getItem:()=>'{bad json'}
    assert.deepEqual(loadCart(),[])
  } finally {globalThis.localStorage=previous}
})
test('shop API sends authentication for private requests and reports expired sessions',async()=>{
  const previous=globalThis.fetch
  try {
    globalThis.fetch=async(url,options)=>{
      assert.equal(url,'/api/shop/checkout');assert.equal(options.headers.Authorization,'Bearer test-token');assert.equal(JSON.parse(options.body).request_key,'request');
      return {ok:false,status:401,json:async()=>({message:'Token inválido'})}
    }
    await assert.rejects(new ShopGateway(new FetchGateway()).checkout({request_key:'request'},{token:'test-token'}),/sesión terminó/)
  } finally {globalThis.fetch=previous}
})
