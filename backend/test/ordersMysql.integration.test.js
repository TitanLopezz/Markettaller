const {MySQLUnitOfWork}=require('../src/infrastructure/database/MySQLUnitOfWork');
const {createResolveProviderOrder}=require('../src/application/use-cases/resolveProviderOrder');
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const mysql = require('mysql2/promise');
const { MySQLOrderRepository } = require('../src/infrastructure/repositories/MySQLOrderRepository');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const hasDatabaseConfig = Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);

test('MySQL order repository creates, joins, lists, resolves orders, and deducts approved quantities', {
  skip: !hasDatabaseConfig,
}, async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });
  let userId;
  let productId;
  const orderIds = [];
  try {
    const marker = randomUUID();
    const email = `orders-${marker}@example.test`;
    const [userResult] = await pool.execute(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES (?, ?, ?, 'proveedor', 'aprobado')`,
      [`Integration ${marker}`, email, 'not-used-in-this-test'],
    );
    userId = userResult.insertId;
    const [productResult] = await pool.execute(
      `INSERT INTO products (nombre, descripcion, precio, categoria, imagen_url, stock)
       VALUES (?, 'Test de integración', 1.00, 'Test', 'https://example.test/product.jpg', 5)`,
      [`Producto ${marker}`],
    );
    productId = productResult.insertId;
    const repository = new MySQLOrderRepository(pool);
    const resolve=createResolveProviderOrder({unitOfWork:new MySQLUnitOfWork(pool)});
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
    const [[product]] = await pool.execute('SELECT stock FROM products WHERE id = ?', [productId]);
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
    const [[unchangedStockOrder]] = await pool.execute(
      `SELECT p.stock, o.status
       FROM products p
       INNER JOIN orders o ON o.product_id = p.id
       WHERE p.id = ? AND o.id = ?`,
      [productId, overStockOrder.id],
    );
    assert.equal(unchangedStockOrder.stock, 2);
    assert.equal(unchangedStockOrder.status, 'pendiente');
  } finally {
    if (orderIds.length) {
      const placeholders = orderIds.map(() => '?').join(', ');
      await pool.execute(`DELETE FROM orders WHERE id IN (${placeholders})`, orderIds);
    }
    if (productId) {
      await pool.execute('DELETE FROM products WHERE id = ?', [productId]);
    }
    if (userId) {
      await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    }
    await pool.end();
  }
});
