const { parsePositiveId } = require('./orderInput');

const createListMyOrders = ({ orderRepository }) => async (providerId) => {
  const validatedProviderId = parsePositiveId(providerId, 'Proveedor');
  return orderRepository.findByProviderId(validatedProviderId);
};

module.exports = { createListMyOrders };
