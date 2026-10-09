const { parseProductId } = require('../../domain/productInput');

const createDeleteProduct = ({ productRepository }) => async (id) => {
  const productId = parseProductId(id);
  let deleted;
  try {
    deleted = await productRepository.delete(productId);
  } catch (cause) {
    if (cause.code === 'REFERENCED') {
      const error = new Error('No se puede eliminar el producto porque tiene pedidos asociados.');
      error.code = 'CONFLICT';
      throw error;
    }
    throw cause;
  }

  if (!deleted) {
    const error = new Error('Producto no encontrado.');
    error.code = 'NOT_FOUND';
    throw error;
  }

  return { id: productId };
};

module.exports = { createDeleteProduct };
