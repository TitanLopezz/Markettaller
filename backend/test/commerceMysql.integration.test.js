const {createServices}=require('../src/bootstrap/createServices');
const test = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const {createCommerce} = require('../src/bootstrap/createCommerce');
const {createApp} = require('../src/infrastructure/http/app');
const {MySQLUserRepository} = require('../src/infrastructure/repositories/MySQLUserRepository');
const {createRegisterUser} = require('../src/application/use-cases/registerUser');
const {createLoginUser} = require('../src/application/use-cases/loginUser');
require('dotenv').config({path:path.join(__dirname,'../.env')});

test('ecommerce HTTP workflow uses isolated MySQL tables and protects checkout, stock and accounts', {skip:!process.env.DB_HOST || !process.env.DB_USER}, async t=>{
  const database=`commerce_test_${randomUUID().replaceAll('-','')}`;
  const settings={host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD||'',multipleStatements:true};
  const root=await mysql.createConnection(settings);
  let pool,server;
  const previousSecret=process.env.JWT_SECRET;
  process.env.JWT_SECRET='commerce-test-secret';
  try {
    await root.query(`CREATE DATABASE \`${database}\``);
    pool=mysql.createPool({...settings,database});
    for(const file of ['schema.sql','commerce.sql']) await pool.query(await fs.readFile(path.join(__dirname,'../src/infrastructure/database',file),'utf8'));
    const userRepository=new MySQLUserRepository(pool);
    const messages=[];
    const commerce=createCommerce(pool,{SHIPPING_FEE_CENTS:'100',FREE_SHIPPING_CENTS:'3000',TRANSFER_INSTRUCTIONS:'Cuenta de prueba',FRONTEND_ORIGIN:'https://example.test',RESEND_API_KEY:'fake',MAIL_FROM:'test@example.test'},async(to,subject,text)=>{messages.push({to,subject,text});return true;});
    const app=createApp({...createServices(pool),commerce});
    server=app.listen(0);
    await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    const request=async(url,token,method='GET',body)=>{
      const response=await fetch(base+url,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
      return {status:response.status,data:await response.json()};
    };
    let customer,other,admin,manager,provider,order,firstProduct,secondProduct;
    const address={recipient:'Ada',phone:'5512345678',street:'Calle Uno 123',district:'Centro',city:'Ciudad de México',state:'CDMX',postal_code:'06000'};
    const body=(key=randomUUID(),items=[{product_id:firstProduct,quantity:2},{product_id:secondProduct,quantity:1}])=>({items,address,payment_method:'contra_entrega',request_key:key,total_cents:1,user_id:999});
    const stock=async id=>{const [[p]]=await pool.execute('SELECT stock FROM products WHERE id=?',[id]);return p.stock;};
    await t.test('public catalog, automatic customer registration, and staff approval remain separate',async()=>{
      assert.equal((await request('/api/shop/catalog')).status,200);
      for(const email of ['ada@example.test','other@example.test']){
        const registered=await request('/api/users/register',null,'POST',{name:'Ada',email,password:'secret123',role:'cliente'});
        assert.equal(registered.status,201);assert.equal(registered.data.user.status,'aprobado');
        const login=await request('/api/users/login',null,'POST',{email,password:'secret123'});
        assert.equal(login.status,200);
        if(email.startsWith('ada'))customer=login.data;else other=login.data;
      }
      const staff=await request('/api/users/register',null,'POST',{name:'Gestor',email:'staff@example.test',password:'secret123',role:'gestor'});
      assert.equal(staff.data.user.status,'pendiente');
      await pool.execute("UPDATE users SET status='aprobado' WHERE id=?",[staff.data.user.id]);
      manager=jwt.sign({sub:staff.data.user.id,role:'gestor',version:0},process.env.JWT_SECRET);
      const [supplier]=await pool.execute("INSERT INTO users (name,email,password_hash,role,status) VALUES ('Proveedor','supplier@example.test','unused','proveedor','aprobado')");
      provider=jwt.sign({sub:supplier.insertId,role:'proveedor',version:0},process.env.JWT_SECRET);
      assert.equal((await request('/api/users/register',null,'POST',{name:'Admin',email:'admin@example.test',password:'secret123',role:'super_admin'})).status,400);
      const [result]=await pool.execute("INSERT INTO users (name,email,password_hash,role,status) VALUES ('Admin','admin@example.test','unused','super_admin','aprobado')");
      admin=jwt.sign({sub:result.insertId,role:'super_admin',version:0},process.env.JWT_SECRET);
      const [p1]=await pool.execute("INSERT INTO products (nombre,descripcion,precio,categoria,stock) VALUES ('Uno','Producto',12.34,'Prueba',8)");firstProduct=p1.insertId;
      const [p2]=await pool.execute("INSERT INTO products (nombre,descripcion,precio,categoria,stock) VALUES ('Dos','Producto',5.00,'Prueba',8)");secondProduct=p2.insertId;
    });
    await t.test('saved addresses are private and validated',async()=>{
      const saved=await request('/api/shop/addresses',customer.token,'POST',address);
      assert.equal(saved.status,200);
      await request(`/api/shop/addresses/${saved.data.id}`,other.token,'DELETE');
      assert.equal((await request('/api/shop/addresses',customer.token)).data.length,1);
      assert.equal((await request('/api/shop/addresses',other.token)).data.length,0);
      assert.equal((await request('/api/shop/addresses',customer.token,'POST',{...address,postal_code:'bad'})).status,400);
    });
    await t.test('checkout snapshots prices, calculates total and shipping, and deduplicates concurrent retries',async()=>{
      const payload=body();
      const results=await Promise.all([request('/api/shop/checkout',customer.token,'POST',payload),request('/api/shop/checkout',customer.token,'POST',payload)]);
      for(const result of results)assert.equal(result.status,200,JSON.stringify(result.data));
      assert.equal(results[0].data.id,results[1].data.id);order=results[0].data;
      assert.equal(Number(order.user_id),customer.user.id);
      assert.equal(Number(order.subtotal_cents),2968);assert.equal(Number(order.shipping_cents),100);assert.equal(Number(order.total_cents),3068);
      assert.equal(await stock(firstProduct),6);assert.equal(await stock(secondProduct),7);
      assert.equal((await request('/api/shop/checkout',customer.token,'POST',{...payload,items:[{product_id:firstProduct,quantity:1}]})).status,409);
      await pool.execute('UPDATE products SET precio=20 WHERE id=?',[firstProduct]);
      const history=await request('/api/shop/orders',customer.token);
      assert.equal(Number(history.data[0].items.find(i=>Number(i.product_id)===firstProduct).unit_price_cents),1234);
      assert.equal((await request(`/api/shop/orders/${order.id}`,other.token)).status,404);
      assert.equal((await request('/api/shop/admin/orders',customer.token)).status,403);
      assert.equal((await request('/api/shop/checkout',null,'POST',body())).status,401);
    });
    await t.test('insufficient stock rolls back the whole cart and competing buyers cannot oversell',async()=>{
      const before=await stock(firstProduct);
      assert.equal((await request('/api/shop/checkout',customer.token,'POST',body(randomUUID(),[{product_id:firstProduct,quantity:1},{product_id:secondProduct,quantity:100}]))).status,409);
      assert.equal(await stock(firstProduct),before);
      await pool.execute('UPDATE products SET stock=1 WHERE id=?',[secondProduct]);
      const competing=await Promise.all([customer,other].map(c=>request('/api/shop/checkout',c.token,'POST',body(randomUUID(),[{product_id:secondProduct,quantity:1}]))));
      assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);assert.equal(await stock(secondProduct),0);
    });
    await t.test('cancel restores stock only once and notifications persist',async()=>{
      assert.equal((await request(`/api/shop/orders/${order.id}/cancel`,other.token,'POST',{})).status,404);
      const cancelled=await request(`/api/shop/orders/${order.id}/cancel`,customer.token,'POST',{});
      assert.equal(cancelled.status,200);assert.equal(cancelled.data.status,'cancelado');assert.equal(await stock(firstProduct),8);
      assert.equal((await request(`/api/shop/orders/${order.id}/cancel`,customer.token,'POST',{})).status,409);
      assert.equal(await stock(firstProduct),8);
      const n=await request('/api/shop/notifications',customer.token);assert.ok(n.data.length>=2);
      await request('/api/shop/notifications/read',customer.token,'PATCH');
      assert.ok((await request('/api/shop/notifications',customer.token)).data.every(n=>n.is_read));
    });
    await t.test('fulfillment requires valid transitions, tracking and a received payment',async()=>{
      const created=await request('/api/shop/checkout',customer.token,'POST',body(randomUUID(),[{product_id:firstProduct,quantity:1}]));
      const id=created.data.id;
      const update=payload=>request(`/api/shop/admin/orders/${id}`,admin,'PATCH',payload);
      assert.equal((await update({status:'entregado'})).status,409);
      assert.equal((await update({status:'confirmado'})).status,200);
      assert.equal((await update({status:'preparando'})).status,200);
      assert.equal((await update({status:'enviado'})).status,400);
      assert.equal((await update({status:'enviado',carrier:'Entrega local',tracking_number:'GUIA-1'})).status,400);
      assert.equal((await request(`/api/shop/fulfillment/orders/${id}/instructions`,admin,'PATCH',{instructions:'Revisar cantidades y proteger el paquete.'})).status,200);
      assert.equal((await update({status:'enviado',carrier:'Entrega local',tracking_number:'GUIA-1'})).status,200);
      assert.equal((await update({status:'entregado'})).status,409);
      assert.equal((await update({payment_status:'pagado'})).status,200);
      assert.equal((await update({status:'entregado'})).status,200);
      assert.equal((await update({status:'cancelado'})).status,409);
    });
    await t.test('product managers coordinate shipping with private instructions but cannot change payments or cancellations',async()=>{
      assert.equal((await request('/api/shop/fulfillment/orders',manager)).status,200);
      assert.equal((await request('/api/shop/admin/orders',manager)).status,403);
      assert.equal((await request('/api/shop/fulfillment/orders',provider)).status,403);
      assert.equal((await request('/api/shop/fulfillment/orders',customer.token)).status,403);
      const created=await request('/api/shop/checkout',customer.token,'POST',body(randomUUID(),[{product_id:firstProduct,quantity:1}]));
      const id=created.data.id;
      const update=data=>request(`/api/shop/fulfillment/orders/${id}`,manager,'PATCH',data);
      assert.equal((await update({payment_status:'pagado'})).status,403);
      assert.equal((await update({status:'cancelado'})).status,403);
      assert.equal((await request(`/api/shop/fulfillment/orders/${id}/instructions`,provider,'PATCH',{instructions:'No permitido'})).status,403);
      assert.equal((await request(`/api/shop/fulfillment/orders/${id}/instructions`,manager,'PATCH',{instructions:'x'.repeat(2001)})).status,400);
      const saved=await request(`/api/shop/fulfillment/orders/${id}/instructions`,manager,'PATCH',{instructions:'Empacar por separado, revisar cantidades y entregar al transportista.'});
      assert.equal(saved.status,200);assert.equal(saved.data.fulfillment.author_name,'Gestor');
      const privateOrder=await request(`/api/shop/orders/${id}`,customer.token);
      assert.equal(Object.hasOwn(privateOrder.data,'fulfillment'),false);
      const privateHistory=await request('/api/shop/orders',customer.token);
      assert.ok(privateHistory.data.every(o=>!Object.hasOwn(o,'fulfillment')));
      assert.equal((await update({status:'confirmado'})).status,200);
      assert.equal((await update({status:'preparando'})).status,200);
      assert.equal((await update({status:'enviado',carrier:'Paquetería',tracking_number:'GESTOR-1'})).status,200);
      assert.equal((await request(`/api/shop/fulfillment/orders/${id}/instructions`,manager,'PATCH',{instructions:'Cambio después de enviar'})).status,409);
      assert.equal((await update({status:'entregado'})).status,409);
      assert.equal((await request(`/api/shop/admin/orders/${id}`,admin,'PATCH',{payment_status:'pagado'})).status,200);
      assert.equal((await update({status:'entregado'})).status,200);
    });
    await t.test('paid cancellation needs a recorded refund and restores reserved stock',async()=>{
      const created=await request('/api/shop/checkout',customer.token,'POST',{...body(randomUUID(),[{product_id:firstProduct,quantity:1}]),payment_method:'transferencia'});
      const id=created.data.id;
      const update=payload=>request(`/api/shop/admin/orders/${id}`,admin,'PATCH',payload);
      await update({payment_status:'pagado'});
      assert.equal((await update({status:'cancelado'})).status,409);
      assert.equal((await update({status:'cancelado',payment_status:'reembolsado'})).status,200);
      assert.equal((await update({payment_status:'pagado'})).status,409);
    });
    await t.test('password recovery tokens expire, are hashed, single-use and invalidate old sessions',async()=>{
      const forgot=await request('/api/shop/forgot-password',null,'POST',{email:'ada@example.test'});
      assert.equal(forgot.status,200);
      assert.deepEqual((await request('/api/shop/forgot-password',null,'POST',{email:'missing@example.test'})).data,forgot.data);
      const expired=messages.findLast(m=>m.subject==='Recuperar contraseña').text.match(/#reset=([a-f0-9]{64})/)[1];
      await pool.execute('UPDATE password_reset_tokens SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE user_id = ?',[customer.user.id]);
      assert.equal((await request('/api/shop/reset-password',null,'POST',{token:expired,password:'expired-secret123'})).status,400);
      await request('/api/shop/forgot-password',null,'POST',{email:'ada@example.test'});
      const token=messages.findLast(m=>m.subject==='Recuperar contraseña').text.match(/#reset=([a-f0-9]{64})/)[1];
      const [[stored]]=await pool.execute('SELECT token_hash FROM password_reset_tokens WHERE user_id=?',[customer.user.id]);assert.notEqual(stored.token_hash,token);
      assert.equal((await request('/api/shop/reset-password',null,'POST',{token,password:'new-secret123'})).status,200);
      assert.equal((await request('/api/shop/reset-password',null,'POST',{token,password:'other-secret123'})).status,400);
      assert.equal((await request('/api/shop/orders',customer.token)).status,401);
      assert.equal((await request('/api/users/login',null,'POST',{email:'ada@example.test',password:'secret123'})).status,401);
      assert.equal((await request('/api/users/login',null,'POST',{email:'ada@example.test',password:'new-secret123'})).status,200);
    });
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    if(pool)await pool.end();
    await root.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await root.end();
    if(previousSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=previousSecret;
  }
});
