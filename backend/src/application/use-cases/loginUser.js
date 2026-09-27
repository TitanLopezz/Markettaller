const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { USER_STATUSES } = require('../../domain/user');

const createLoginUser = ({ userRepository, jwtSecret }) => async ({ email, password }) => {
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    const error = new Error('Email y contraseña son obligatorios.');
    error.statusCode = 400;
    throw error;
  }

  const user = await userRepository.findByEmail(email.trim().toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error('Credenciales incorrectas.');
    error.statusCode = 401;
    throw error;
  }

  if (user.status === USER_STATUSES.PENDING) {
    const error = new Error('Cuenta pendiente de autorización');
    error.statusCode = 403;
    throw error;
  }

  if (user.status !== USER_STATUSES.APPROVED) {
    const error = new Error('La cuenta no está autorizada para iniciar sesión.');
    error.statusCode = 403;
    throw error;
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    jwtSecret,
    { expiresIn: '1h' },
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
