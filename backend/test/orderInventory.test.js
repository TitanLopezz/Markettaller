const {MySQLUnitOfWork}=require('../src/infrastructure/database/MySQLUnitOfWork');
const {createResolveProviderOrder}=require('../src/application/use-cases/resolveProviderOrder');
const assert = require('node:assert/strict');
const test = require('node:test');
const { MySQLOrderRepository } = require('../src/infrastructure/repositories/MySQLOrderRepository');

const createTransactionalPool = ({ stock = 5, orderStatus = 'pendiente' } = {}) => {
  const calls = {
    stockUpdates: [],
    statusUpdates: [],
    committed: false,
    rolledBack: false,
    released: false,
    readStock: false,
  };
  const connection = {
    beginTransaction: async () => {},
    commit: async () => { calls.committed = true; },
    rollback: async () => { calls.rolledBack = true; },
    release: () => { calls.released = true; },
    execute: async (query, params) => {
      if (query.includes('FROM orders') && query.includes('FOR UPDATE')) {
        return [[{ id: 10, product_id: 20, quantity: 3, status: orderStatus }], []];
      }
      if (query.includes('FROM products') && query.includes('FOR UPDATE')) {
        calls.readStock = true;
        return [[{ id: 20, stock }], []];
      }
      if (query.startsWith('UPDATE products SET stock')) {
        calls.stockUpdates.push(params);
        return [{ affectedRows: 1 }, []];
      }
      if (query.startsWith('UPDATE orders SET status')) {
        calls.statusUpdates.push(params);
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected query: ${query}`);
    },
  };

  return { pool: { getConnection: async () => connection }, calls };
};

test('approving an order atomically deducts stock and resolves the order', async () => {
  const { pool, calls } = createTransactionalPool({ stock: 5 });
  const resolve=createResolveProviderOrder({unitOfWork:new MySQLUnitOfWork(pool)});

  const result = await resolve(10, 'aprobado');

  assert.deepEqual(result, { updated: true, id: 10, status: 'aprobado' });
  assert.deepEqual(calls.stockUpdates, [[3, 20, 3]]);
  assert.deepEqual(calls.statusUpdates, [['aprobado', 10, 'pendiente']]);
  assert.equal(calls.committed, true);
  assert.equal(calls.rolledBack, false);
  assert.equal(calls.released, true);
});

test('an order cannot be approved when product stock is insufficient', async () => {
  const { pool, calls } = createTransactionalPool({ stock: 2 });
  const resolve=createResolveProviderOrder({unitOfWork:new MySQLUnitOfWork(pool)});

  await assert.rejects(
    resolve(10, 'aprobado'),
    { code: 'CONFLICT', message: 'Stock insuficiente para aprobar el pedido.' },
  );

  assert.equal(calls.readStock, true);
  assert.equal(calls.stockUpdates.length, 0);
  assert.equal(calls.statusUpdates.length, 0);
  assert.equal(calls.committed, false);
  assert.equal(calls.rolledBack, true);
  assert.equal(calls.released, true);
});

test('rejecting an order leaves product stock unchanged', async () => {
  const { pool, calls } = createTransactionalPool({ stock: 5 });
  const resolve=createResolveProviderOrder({unitOfWork:new MySQLUnitOfWork(pool)});

  const result = await resolve(10, 'rechazado');

  assert.deepEqual(result, { updated: true, id: 10, status: 'rechazado' });
  assert.equal(calls.readStock, false);
  assert.equal(calls.stockUpdates.length, 0);
  assert.deepEqual(calls.statusUpdates, [['rechazado', 10, 'pendiente']]);
  assert.equal(calls.committed, true);
});
