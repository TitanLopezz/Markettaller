const { USER_STATUSES } = require('../../domain/user');

const createLoginUser = ({ userRepository, passwordHasher, tokenService }) => async ({ email, password }) => {
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    const error = new Error('Email y contraseña son obligatorios.');
    error.code = 'VALIDATION';
    throw error;
  }

  const user = await userRepository.findByEmail(email.trim().toLowerCase());
  if (!user || !(await passwordHasher.compare(password, user.passwordHash))) {
    const error = new Error('Credenciales incorrectas.');
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  if (user.status === USER_STATUSES.PENDING) {
    const error = new Error('Cuenta pendiente de autorización');
    error.code = 'FORBIDDEN';
    throw error;
  }

  if (user.status !== USER_STATUSES.APPROVED) {
    const error = new Error('La cuenta no está autorizada para iniciar sesión.');
    error.code = 'FORBIDDEN';
    throw error;
  }

  const token = tokenService.sign(
    { sub: user.id, role: user.role, version: user.authVersion || 0 },
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  };
};

module.exports = { createLoginUser };
