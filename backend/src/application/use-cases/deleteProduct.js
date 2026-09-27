const { parseProductId } = require('./productInput');

const createDeleteProduct = ({ productRepository }) => async (id) => {
  const productId = parseProductId(id);
  const deleted = await productRepository.delete(productId);

  if (!deleted) {
    const error = new Error('Producto no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return { id: productId };
};

module.exports = { createDeleteProduct };
