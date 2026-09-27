const path = require('node:path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { USER_ROLES, USER_STATUSES } = require('../src/domain/user');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const run = async () => {
  const name = process.env.SUPER_ADMIN_NAME?.trim() || 'Super Admin';
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password || password.length < 12) {
    throw new Error('Configura SUPER_ADMIN_EMAIL y una SUPER_ADMIN_PASSWORD de al menos 12 caracteres en backend/.env.');
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  try {
    const [existingUsers] = await pool.execute(
      'SELECT id, role, status FROM users WHERE email = ? LIMIT 1',
      [email],
    );

    if (existingUsers.length) {
      const existing = existingUsers[0];
      if (existing.role === USER_ROLES.SUPER_ADMIN && existing.status === USER_STATUSES.APPROVED) {
        console.log('La cuenta Super Admin ya existe y está aprobada.');
        return;
      }
      throw new Error('Ese email ya pertenece a otra cuenta; no se modificó su rol.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.execute(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      [name, email, passwordHash, USER_ROLES.SUPER_ADMIN, USER_STATUSES.APPROVED],
    );
    console.log('Cuenta Super Admin creada y aprobada.');
  } finally {
    await pool.end();
  }
};

run().catch((error) => {
  console.error('No se pudo crear Super Admin:', error.message);
  process.exitCode = 1;
});
