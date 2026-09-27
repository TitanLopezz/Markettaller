const bcrypt = require('bcryptjs');
const { USER_STATUSES, SELF_REGISTER_ROLES } = require('../../domain/user');

const createRegisterUser = ({ userRepository }) => async ({ name, email, password, role }) => {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!cleanName || !cleanEmail || typeof password !== 'string' || !password) {
    const error = new Error('Nombre, email y contraseña son obligatorios.');
    error.statusCode = 400;
    throw error;
  }

  if (!SELF_REGISTER_ROLES.includes(role)) {
    const error = new Error('El rol debe ser gestor o proveedor.');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    return await userRepository.create({
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      role,
      status: USER_STATUSES.PENDING,
    });
  } catch (cause) {
    if (cause.code === 'ER_DUP_ENTRY') {
      const error = new Error('Ya existe una cuenta con ese email.');
      error.statusCode = 409;
      throw error;
    }
    throw cause;
  }
};

module.exports = { createRegisterUser };
