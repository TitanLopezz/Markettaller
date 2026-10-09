const { USER_STATUSES } = require('../../domain/user');

const createUpdateUserStatus = ({ userRepository }) => async ({ id, status }) => {
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId < 1) {
    const error = new Error('El identificador de usuario no es válido.');
    error.code = 'VALIDATION';
    throw error;
  }

  if (![USER_STATUSES.APPROVED, USER_STATUSES.REJECTED].includes(status)) {
    const error = new Error('El estado debe ser aprobado o rechazado.');
    error.code = 'VALIDATION';
    throw error;
  }

  const result = await userRepository.updatePendingStatus(userId, status);
  if (!result) {
    const error = new Error('Usuario no encontrado.');
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (!result.updated) {
    const error = new Error('El usuario ya no está pendiente.');
    error.code = 'CONFLICT';
    throw error;
  }

  return { id: result.id, status: result.status };
};

module.exports = { createUpdateUserStatus };
