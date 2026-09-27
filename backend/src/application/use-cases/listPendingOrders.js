const createListPendingOrders = ({ orderRepository }) => async () => orderRepository.findPending();

module.exports = { createListPendingOrders };
