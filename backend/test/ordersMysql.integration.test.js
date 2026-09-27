const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const mysql = require('mysql2/promise');
const { MySQLOrderRepository } = require('../src/infrastructure/repositories/MySQLOrderRepository');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const hasDatabaseConfig = Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);

test('MySQL order repository creates, joins, lists, and resolves an order inside a rollback transaction', {
  skip: !hasDatabaseConfig,
}, async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const marker = randomUUID();
    const email = `orders-${marker}@example.test`;
    const [userResult] = await connection.execute(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES (?, ?, ?, 'proveedor', 'aprobado')`,
      [`Integration ${marker}`, email, 'not-used-in-this-test'],
    );
    const [productResult] = await connection.execute(
      `INSERT INTO products (nombre, descripcion, precio, categoria, imagen_url, stock)
       VALUES (?, 'Test de integración', 1.00, 'Test', 'https://example.test/product.jpg', 1)`,
      [`Producto ${marker}`],
    );
    const repository = new MySQLOrderRepository(connection);
    const created = await repository.create({
      providerId: userResult.insertId,
      productId: productResult.insertId,
      quantity: 3,
    });

    assert.equal(created.status, 'pendiente');
    const history = await repository.findByProviderId(userResult.insertId);
    assert.equal(history[0].product_name, `Producto ${marker}`);
    assert.equal(history[0].product_image_url, 'https://example.test/product.jpg');

    const pending = await repository.findPending();
    const pendingOrder = pending.find((order) => order.id === created.id);
    assert.equal(pendingOrder.provider_email, email);
    assert.equal(pendingOrder.product_name, `Producto ${marker}`);

    const update = await repository.updatePendingStatus(created.id, 'aprobado');
    assert.equal(update.updated, true);
    assert.equal(update.status, 'aprobado');
  } finally {
    await connection.rollback();
    connection.release();
    await pool.end();
  }
});
