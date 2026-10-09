const { normalizeProductInput } = require('../../domain/productInput');

const createCreateProduct = ({ productRepository }) => async (input) => {
  const product = normalizeProductInput(input);
  return productRepository.create(product);
};

module.exports = { createCreateProduct };
