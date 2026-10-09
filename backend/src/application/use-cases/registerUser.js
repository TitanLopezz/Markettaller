const { USER_STATUSES, USER_ROLES, SELF_REGISTER_ROLES } = require('../../domain/user');

const createRegisterUser = ({ userRepository, passwordHasher, crypto }) => async ({ name, email, password, role }) => {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!cleanName || !cleanEmail || typeof password !== 'string' || !password) {
    const error = new Error('Nombre, email y contraseña son obligatorios.');
    error.code = 'VALIDATION';
    throw error;
  }

  if (!SELF_REGISTER_ROLES.includes(role)) {
    const error = new Error('El rol debe ser cliente, gestor o proveedor.');
    error.code = 'VALIDATION';
    throw error;
  }

  if (cleanName.length > 120 || cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || password.length < 8 || crypto.byteLength(password) > 72) {
    const error = new Error('Usa un email válido y una contraseña de 8 caracteres como mínimo y 72 bytes como máximo.');
    error.code = 'VALIDATION';
    throw error;
  }

  const passwordHash = await passwordHasher.hash(password);

  try {
    return await userRepository.create({
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      role,
      status: role === USER_ROLES.CUSTOMER ? USER_STATUSES.APPROVED : USER_STATUSES.PENDING,
    });
  } catch (cause) {
    if (cause.code === 'DUPLICATE') {
      const error = new Error('Ya existe una cuenta con ese email.');
      error.code = 'CONFLICT';
      throw error;
    }
    throw cause;
  }
};

module.exports = { createRegisterUser };
