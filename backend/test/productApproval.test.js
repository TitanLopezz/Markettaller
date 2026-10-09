const {PostgresUnitOfWork}=require('../src/infrastructure/database/PostgresUnitOfWork');
const {createResolveProductRequest}=require('../src/application/use-cases/resolveProductRequest');
const assert = require('node:assert/strict');
const test = require('node:test');
const { createCreateProductRequest } = require('../src/application/use-cases/createProductRequest');
const { createUpdateProductRequestStatus } = require('../src/application/use-cases/updateProductRequestStatus');
const { PostgresProductRequestRepository } = require('../src/infrastructure/repositories/PostgresProductRequestRepository');

const createRequestRecord = (requestType, productId = null) => ({
  id: 5,
  request_type: requestType,
  product_id: productId,
  product_data: JSON.stringify({
    nombre: 'Audifonos',
    descripcion: '',
    precio: 100,
    categoria: 'tecnologia',
    imagen_url: null,
    stock: 3,
  }),
  status: 'pendiente',
});

const createTransactionalPool = (request, deleteError = null) => {
  const calls = { inserts: [], deletes: [], committed: false, rolledBack: false, updatedStatus: null };
  const connection = {
    beginTransaction: async () => {},
    commit: async () => { calls.committed = true; },
    rollback: async () => { calls.rolledBack = true; },
    release: () => {},
    execute: async (query, params) => {
      if (query.startsWith('SELECT id, request_type')) {
        return [[request], []];
      }
      if (query.startsWith('INSERT INTO products')) {
        calls.inserts.push(params);
        return [{ insertId: 17 }, []];
      }
      if (query.startsWith('DELETE FROM products')) {
        calls.deletes.push(params);
        if (deleteError) {
          throw deleteError;
        }
        return [{ affectedRows: 1 }, []];
      }
      if (query.startsWith('UPDATE product_requests')) {
        calls.updatedStatus = params[0];
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected query: ${query}`);
    },
  };

  connection.query=async(sql,params)=>{
 if(sql==='BEGIN')return connection.beginTransaction();
 if(sql==='COMMIT')return connection.commit();
 if(sql==='ROLLBACK')return connection.rollback();
 const [result]=await connection.execute(sql,params);
 return {command:sql.startsWith('SELECT')?'SELECT':'WRITE',rows:Array.isArray(result)?result:result.insertId?[{id:result.insertId}]:[],rowCount:result.affectedRows||1};
 };
 return {pool:{connect:async()=>connection},calls};
};

test('manager create requests normalize product data without inserting a product', async () => {
  let savedRequest;
  const createRequest = createCreateProductRequest({
    productRepository: {},
    productRequestRepository: {
      create: async (request) => {
        savedRequest = request;
        return { id: 8, ...request };
      },
    },
  });

  const result = await createRequest({
    requesterId: 4,
    requestType: 'crear',
    product: {
      nombre: ' Audifonos ',
      descripcion: ' Bluetooth ',
      precio: '100',
      categoria: ' tecnologia ',
      imagen_url: '',
      stock: '3',
    },
  });

  assert.equal(result.id, 8);
  assert.deepEqual(savedRequest, {
    requesterId: 4,
    requestType: 'crear',
    productData: {
      nombre: 'Audifonos',
      descripcion: 'Bluetooth',
      precio: 100,
      categoria: 'tecnologia',
      imagen_url: null,
      stock: 3,
    },
  });
});

test('approving a create request inserts the product and commits its status atomically', async () => {
  const { pool, calls } = createTransactionalPool(createRequestRecord('crear'));
  const resolve=createResolveProductRequest({unitOfWork:new PostgresUnitOfWork(pool)});

  const result = await resolve(5, 'aprobado', 3);

  assert.equal(result.updated, true);
  assert.equal(calls.inserts.length, 1);
  assert.equal(calls.deletes.length, 0);
  assert.equal(calls.updatedStatus, 'aprobado');
  assert.equal(calls.committed, true);
  assert.equal(calls.rolledBack, false);
});

test('rejecting a delete request leaves the product untouched', async () => {
  const { pool, calls } = createTransactionalPool(createRequestRecord('eliminar', 17));
  const resolve=createResolveProductRequest({unitOfWork:new PostgresUnitOfWork(pool)});

  const result = await resolve(5, 'rechazado', 3);

  assert.equal(result.updated, true);
  assert.equal(calls.deletes.length, 0);
  assert.equal(calls.inserts.length, 0);
  assert.equal(calls.updatedStatus, 'rechazado');
  assert.equal(calls.committed, true);
});

test('a product referenced by orders cannot be deleted through an approved request', async () => {
  const deleteError = Object.assign(new Error('Foreign key constraint'), { code: '23503', table: 'products' });
  const { pool, calls } = createTransactionalPool(createRequestRecord('eliminar', 17), deleteError);
  const resolve=createResolveProductRequest({unitOfWork:new PostgresUnitOfWork(pool)});

  await assert.rejects(
    resolve(5, 'aprobado', 3),
    { code: 'CONFLICT', message: 'No se puede eliminar el producto porque tiene pedidos asociados.' },
  );
  assert.equal(calls.updatedStatus, null);
  assert.equal(calls.committed, false);
  assert.equal(calls.rolledBack, true);
});

test('product request decisions accept only approved or rejected statuses', async () => {
  const updateStatus = createUpdateProductRequestStatus({
    resolveProductRequest: async (id, status, reviewerId) => ({ updated: true, id, status, reviewerId }),
  });

  await assert.rejects(
    updateStatus({ id: 5, status: 'pendiente', reviewerId: 3 }),
    { code: 'VALIDATION' },
  );
  assert.deepEqual(await updateStatus({ id: '5', status: 'aprobado', reviewerId: 3 }), {
    updated: true,
    id: 5,
    status: 'aprobado',
    reviewerId: 3,
  });
});
