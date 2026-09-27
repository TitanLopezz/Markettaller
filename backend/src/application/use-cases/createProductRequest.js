const { normalizeProductInput, parseProductId } = require('./productInput');

const createCreateProductRequest = ({ productRepository, productRequestRepository }) => async ({
  requesterId,
  requestType,
  product,
  productId,
}) => {
  if (requestType === 'crear') {
    return productRequestRepository.create({
      requesterId,
      requestType,
      productData: normalizeProductInput(product),
    });
  }

  if (requestType !== 'eliminar') {
    const error = new Error('El tipo de solicitud no es válido.');
    error.statusCode = 400;
    throw error;
  }

  const id = parseProductId(productId);
  const existingProduct = await productRepository.findById(id);
  if (!existingProduct) {
    const error = new Error('Producto no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  if (await productRequestRepository.hasPendingDelete(id)) {
    const error = new Error('Ya existe una solicitud de eliminación pendiente para este producto.');
    error.statusCode = 409;
    throw error;
  }

  return productRequestRepository.create({
    requesterId,
    requestType,
    productId: id,
    productData: existingProduct,
  });
};

module.exports = { createCreateProductRequest };