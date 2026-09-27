const ORDER_STATUSES = Object.freeze({
  PENDING: 'pendiente',
  APPROVED: 'aprobado',
  REJECTED: 'rechazado',
});

const RESOLVED_ORDER_STATUSES = Object.freeze([
  ORDER_STATUSES.APPROVED,
  ORDER_STATUSES.REJECTED,
]);

module.exports = { ORDER_STATUSES, RESOLVED_ORDER_STATUSES };
