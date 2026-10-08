const { parseProductId } = require('./productInput');

const createDeleteProduct = ({ productRepository }) => async (id) => {
  const productId = parseProductId(id);
  let deleted;
  try {
    deleted = await productRepository.delete(productId);
  } catch (cause) {
    if (cause.code === 'ER_ROW_IS_REFERENCED_2') {
      const error = new Error('No se puede eliminar el producto porque tiene pedidos asociados.');
      error.statusCode = 409;
      throw error;
    }
    throw cause;
  }

  if (!deleted) {
    const error = new Error('Producto no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return { id: productId };
};

module.exports = { createDeleteProduct };
