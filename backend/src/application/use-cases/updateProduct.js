const { normalizeProductInput, parseProductId } = require('../../domain/productInput');

const createUpdateProduct = ({ productRepository }) => async ({ id, ...input }) => {
  const productId = parseProductId(id);
  const product = normalizeProductInput(input);
  const updatedProduct = await productRepository.update(productId, product);

  if (!updatedProduct) {
    const error = new Error('Producto no encontrado.');
    error.code = 'NOT_FOUND';
    throw error;
  }

  return updatedProduct;
};

module.exports = { createUpdateProduct };
