const { RESOLVED_ORDER_STATUSES } = require('../../domain/order');
const { parsePositiveId } = require('../../domain/orderInput');

const createUpdateOrderStatus = ({ resolveProviderOrder }) => async ({ id, status }) => {
  const orderId = parsePositiveId(id, 'Pedido');
  if (!RESOLVED_ORDER_STATUSES.includes(status)) {
    const error = new Error('El estado debe ser aprobado o rechazado.');
    error.code = 'VALIDATION';
    throw error;
  }

  const result = await resolveProviderOrder(orderId, status);
  if (!result) {
    const error = new Error('Pedido no encontrado.');
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (!result.updated) {
    const error = new Error('El pedido ya no está pendiente.');
    error.code = 'CONFLICT';
    throw error;
  }

  return { id: result.id, status: result.status };
};

module.exports = { createUpdateOrderStatus };
