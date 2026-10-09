const USER_ROLES = Object.freeze({
  CUSTOMER: 'cliente',
  PRODUCT_MANAGER: 'gestor',
  SUPPLIER: 'proveedor',
  SUPER_ADMIN: 'super_admin',
});

const SELF_REGISTER_ROLES = Object.freeze([
  USER_ROLES.CUSTOMER,
  USER_ROLES.PRODUCT_MANAGER,
  USER_ROLES.SUPPLIER,
]);

const USER_STATUSES = Object.freeze({
  PENDING: 'pendiente',
  APPROVED: 'aprobado',
  REJECTED: 'rechazado',
});

module.exports = { USER_ROLES, USER_STATUSES, SELF_REGISTER_ROLES };
