const {PostgresUnitOfWork}=require('../src/infrastructure/database/PostgresUnitOfWork');
const {createResolveProviderOrder}=require('../src/application/use-cases/resolveProviderOrder');
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const {Client,Pool}=require('pg');
require('../src/infrastructure/database/postgresPool');
const {execute}=require('../src/infrastructure/database/persistenceErrors');
const { PostgresOrderRepository } = require('../src/infrastructure/repositories/PostgresOrderRepository');


const hasDatabaseConfig = Boolean(process.env.PG_TEST_HOST && process.env.PG_TEST_USER);

test('Postgres order repository creates, joins, lists, resolves orders, and deducts approved quantities', {
  skip: !hasDatabaseConfig,
}, async () => {
  const database='orders_test_'+randomUUID().replaceAll('-','');
  const admin=new Client({host:process.env.PG_TEST_HOST,port:Number(process.env.PG_TEST_PORT||5432),user:process.env.PG_TEST_USER,password:process.env.PG_TEST_PASSWORD||'',database:'postgres'});
  await admin.connect();await admin.query('CREATE DATABASE "'+database+'"');
  const pool = new Pool({
    host: process.env.PG_TEST_HOST || '127.0.0.1',
    port: Number(process.env.PG_TEST_PORT || 5432),
    user: process.env.PG_TEST_USER,
    password: process.env.PG_TEST_PASSWORD || '',
    database,
  });
  for(const file of ['schema.sql','commerce.sql'])await pool.query(await require('node:fs/promises').readFile(path.join(__dirname,'../src/infrastructure/database',file),'utf8'));
  let userId;
  let productId;
  const orderIds = [];
  try {
    const marker = randomUUID();
    const email = `orders-${marker}@example.test`;
    const [userResult] = await execute(pool,
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1, $2, $3, 'proveedor', 'aprobado') RETURNING id`,
      [`Integration ${marker}`, email, 'not-used-in-this-test'],
    );
    userId = userResult.insertId;
    const [productResult] = await execute(pool,
      `INSERT INTO products (nombre, descripcion, precio, categoria, imagen_url, stock)
       VALUES ($1, 'Test de integración', 1.00, 'Test', 'https://example.test/product.jpg', 5) RETURNING id`,
      [`Producto ${marker}`],
    );
    productId = productResult.insertId;
    const repository = new PostgresOrderRepository(pool);
    const resolve=createResolveProviderOrder({unitOfWork:new PostgresUnitOfWork(pool)});
    const created = await repository.create({
      providerId: userId,
      productId: productResult.insertId,
      quantity: 3,
    });
    orderIds.push(created.id);

    assert.equal(created.status, 'pendiente');
    const history = await repository.findByProviderId(userId);
    assert.equal(history[0].product_name, `Producto ${marker}`);
    assert.equal(history[0].product_image_url, 'https://example.test/product.jpg');

    const pending = await repository.findPending();
    const pendingOrder = pending.find((order) => order.id === created.id);
    assert.equal(pendingOrder.provider_email, email);
    assert.equal(pendingOrder.product_name, `Producto ${marker}`);

    const update = await resolve(created.id, 'aprobado');
    assert.equal(update.updated, true);
    assert.equal(update.status, 'aprobado');
    const [[product]] = await execute(pool,'SELECT stock FROM products WHERE id = $1', [productId]);
    assert.equal(product.stock, 2);

    const overStockOrder = await repository.create({
      providerId: userId,
      productId,
      quantity: 3,
    });
    orderIds.push(overStockOrder.id);
    await assert.rejects(
      resolve(overStockOrder.id, 'aprobado'),
      { code: 'CONFLICT', message: 'Stock insuficiente para aprobar el pedido.' },
    );
    const [[unchangedStockOrder]] = await execute(pool,
      `SELECT p.stock, o.status
       FROM products p
       INNER JOIN orders o ON o.product_id = p.id
       WHERE p.id = $1 AND o.id = $2`,
      [productId, overStockOrder.id],
    );
    assert.equal(unchangedStockOrder.stock, 2);
    assert.equal(unchangedStockOrder.status, 'pendiente');
  } finally {
    if (orderIds.length) {
      const placeholders = orderIds.map((_,i) => '$'+(i+1)).join(', ');
      await execute(pool,`DELETE FROM orders WHERE id IN (${placeholders})`, orderIds);
    }
    if (productId) {
      await execute(pool,'DELETE FROM products WHERE id = $1', [productId]);
    }
    if (userId) {
      await execute(pool,'DELETE FROM users WHERE id = $1', [userId]);
    }
    await pool.end();
    await admin.query('DROP DATABASE "'+database+'"');await admin.end();
  }
});
