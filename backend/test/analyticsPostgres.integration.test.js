const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');
const {AnalyticsRepositoryAdapter}=require('../src/infrastructure/repositories/AnalyticsRepositoryAdapter');
test('PostgreSQL aggregates historic prices, excludes unpaid/cancelled sales and fills empty days', {skip:!process.env.PG_TEST_HOST},async()=>{
  const client=new Client({host:process.env.PG_TEST_HOST,port:Number(process.env.PG_TEST_PORT||5432),user:process.env.PG_TEST_USER,password:process.env.PG_TEST_PASSWORD||'',database:'postgres'});
  await client.connect();
  try {
    // Temporary tables shadow real tables in this connection; no operational data is changed.
    await client.query(`CREATE TEMP TABLE shop_orders(id int,user_id int,total_cents bigint,payment_status text,status text,created_at timestamptz);
      CREATE TEMP TABLE shop_order_items(order_id int,product_id int,product_name text,quantity int,unit_price_cents bigint);
      INSERT INTO shop_orders VALUES
      (1,1,25000,'pagado','confirmado','2026-10-01T00:00:00Z'),
      (2,1,15000,'pagado','enviado','2026-10-01T23:59:59Z'),
      (3,2,10000,'pendiente','recibido','2026-10-01T12:00:00Z'),
      (4,2,90000,'pagado','cancelado','2026-10-01T12:00:00Z'),
      (5,2,90000,'pagado','enviado','2026-10-03T00:00:00Z');
      INSERT INTO shop_order_items VALUES (1,1,'Uno',2,10000),(2,1,'Uno',1,10000),(3,2,'Dos',10,1000),(4,2,'Dos',90,1000),(5,2,'Dos',90,1000);`);
    const repository=new AnalyticsRepositoryAdapter(client);
    const result=await repository.dashboard({start:'2026-10-01T00:00:00Z',end:'2026-10-03T00:00:00Z',top:5});
    assert.deepEqual(result.summary,{totalRevenue:400,paidOrders:2,customers:1,averageOrder:200,averageUser:400});
    assert.deepEqual(result.trend,[{date:'2026-10-01',revenue:400},{date:'2026-10-02',revenue:0}]);
    assert.deepEqual(result.topProducts,[{productId:1,name:'Uno',units:3,revenue:300}]);
    assert.ok(result.orderStates.every(s=>s.count===1&&s.percentage===25));
    const empty=await repository.dashboard({start:'2020-01-01T00:00:00Z',end:'2020-01-02T00:00:00Z',top:10});
    assert.equal(empty.summary.averageUser,0);assert.deepEqual(empty.topProducts,[]);assert.ok(empty.orderStates.every(s=>s.percentage===0));
  } finally {await client.end();}
});
