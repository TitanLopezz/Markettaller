const { normalizeProductInput, parseProductId } = require('./productInput');

const createUpdateProduct = ({ productRepository }) => async ({ id, ...input }) => {
  const productId = parseProductId(id);
  const product = normalizeProductInput(input);
  const updatedProduct = await productRepository.update(productId, product);

  if (!updatedProduct) {
    const error = new Error('Producto no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return updatedProduct;
};

module.exports = { createUpdateProduct };
