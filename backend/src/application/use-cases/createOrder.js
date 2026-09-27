const { ORDER_STATUSES } = require('../../domain/order');
const { parsePositiveId } = require('./orderInput');

const createCreateOrder = ({ orderRepository }) => async ({ providerId, productId, quantity }) => {
  const validatedProviderId = parsePositiveId(providerId, 'Proveedor');
  const validatedProductId = parsePositiveId(productId, 'Producto');

  if (quantity === '' || quantity === null || quantity === undefined) {
    const error = new Error('La cantidad debe ser un entero mayor que cero.');
    error.statusCode = 400;
    throw error;
  }

  const validatedQuantity = Number(quantity);
  if (!Number.isSafeInteger(validatedQuantity) || validatedQuantity < 1) {
    const error = new Error('La cantidad debe ser un entero mayor que cero.');
    error.statusCode = 400;
    throw error;
  }

  try {
    const order = await orderRepository.create({
      providerId: validatedProviderId,
      productId: validatedProductId,
      quantity: validatedQuantity,
      status: ORDER_STATUSES.PENDING,
    });
    return order;
  } catch (cause) {
    if (cause.code === 'ER_NO_REFERENCED_ROW_2') {
      const error = new Error('El producto solicitado no existe.');
      error.statusCode = 404;
      throw error;
    }
    throw cause;
  }
};

module.exports = { createCreateOrder };
