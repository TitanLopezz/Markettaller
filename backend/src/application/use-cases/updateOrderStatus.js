const { RESOLVED_ORDER_STATUSES } = require('../../domain/order');
const { parsePositiveId } = require('./orderInput');

const createUpdateOrderStatus = ({ orderRepository }) => async ({ id, status }) => {
  const orderId = parsePositiveId(id, 'Pedido');
  if (!RESOLVED_ORDER_STATUSES.includes(status)) {
    const error = new Error('El estado debe ser aprobado o rechazado.');
    error.statusCode = 400;
    throw error;
  }

  const result = await orderRepository.updatePendingStatus(orderId, status);
  if (!result) {
    const error = new Error('Pedido no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  if (!result.updated) {
    const error = new Error('El pedido ya no está pendiente.');
    error.statusCode = 409;
    throw error;
  }

  return { id: result.id, status: result.status };
};

module.exports = { createUpdateOrderStatus };
