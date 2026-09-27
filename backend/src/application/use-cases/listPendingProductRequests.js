const createListPendingProductRequests = ({ productRequestRepository }) => async () => (
  productRequestRepository.findPending()
);

module.exports = { createListPendingProductRequests };