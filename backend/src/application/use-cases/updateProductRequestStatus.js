const { parseProductId } = require('../../domain/productInput');

const PRODUCT_REQUEST_RESOLVED_STATUSES = ['aprobado', 'rechazado'];

const createUpdateProductRequestStatus = ({ resolveProductRequest }) => async ({ id, status, reviewerId }) => {
  const requestId = parseProductId(id);
  if (!PRODUCT_REQUEST_RESOLVED_STATUSES.includes(status)) {
    const error = new Error('El estado debe ser aprobado o rechazado.');
    error.code = 'VALIDATION';
    throw error;
  }

  const result = await resolveProductRequest(requestId, status, reviewerId);
  if (!result) {
    const error = new Error('Solicitud de producto no encontrada.');
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (!result.updated) {
    const error = new Error('La solicitud ya fue revisada.');
    error.code = 'CONFLICT';
    throw error;
  }

  return result;
};

module.exports = { createUpdateProductRequestStatus };
