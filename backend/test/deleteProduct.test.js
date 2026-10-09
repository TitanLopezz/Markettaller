const assert = require('node:assert/strict');
const test = require('node:test');
const { createDeleteProduct } = require('../src/application/use-cases/deleteProduct');

test('direct deletion reports a conflict when orders reference the product', async () => {
  const deleteProduct = createDeleteProduct({
    productRepository: {
      delete: async () => {
        throw Object.assign(new Error('Foreign key constraint'), { code: 'REFERENCED' });
      },
    },
  });
  await assert.rejects(deleteProduct(1), {
    code: 'CONFLICT',
    message: 'No se puede eliminar el producto porque tiene pedidos asociados.',
  });
});
