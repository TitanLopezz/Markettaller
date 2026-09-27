const { parseProductId } = require('./productInput');

const PRODUCT_REQUEST_RESOLVED_STATUSES = ['aprobado', 'rechazado'];

const createUpdateProductRequestStatus = ({ productRequestRepository }) => async ({ id, status, reviewerId }) => {
  const requestId = parseProductId(id);
  if (!PRODUCT_REQUEST_RESOLVED_STATUSES.includes(status)) {
    const error = new Error('El estado debe ser aprobado o rechazado.');
    error.statusCode = 400;
    throw error;
  }

  const result = await productRequestRepository.updatePendingStatus(requestId, status, reviewerId);
  if (!result) {
    const error = new Error('Solicitud de producto no encontrada.');
    error.statusCode = 404;
    throw error;
  }

  if (!result.updated) {
    const error = new Error('La solicitud ya fue revisada.');
    error.statusCode = 409;
    throw error;
  }

  return result;
};

module.exports = { createUpdateProductRequestStatus };