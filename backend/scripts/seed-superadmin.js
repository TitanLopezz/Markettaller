const path = require('node:path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { USER_ROLES, USER_STATUSES } = require('../src/domain/user');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const assertSuperAdminAccount = (existingUsers) => {
  if (existingUsers.length && existingUsers[0].role !== USER_ROLES.SUPER_ADMIN) {
    throw new Error('Ese email ya pertenece a otra cuenta; no se modificó su rol.');
  }
};

const run = async () => {
  const name = process.env.SUPER_ADMIN_NAME?.trim() || 'Super Admin';
  const configuredEmail = process.env.SUPERADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL;
  const email = configuredEmail?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Configura SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD en backend/.env.');
  }

  const missingDatabaseSettings = ['DB_HOST', 'DB_USER', 'DB_NAME'].filter((key) => !process.env[key]);
  if (missingDatabaseSettings.length) {
    throw new Error(`Faltan variables de entorno: ${missingDatabaseSettings.join(', ')}`);
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [existingUsers] = await connection.execute(
        'SELECT id, role FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
        [email],
      );
      assertSuperAdminAccount(existingUsers);

      await connection.execute(
        `INSERT INTO users (name, email, password_hash, role, status)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           password_hash = VALUES(password_hash),
           status = VALUES(status)`,
        [name, email, passwordHash, USER_ROLES.SUPER_ADMIN, USER_STATUSES.APPROVED],
      );
      await connection.commit();
      console.log(`Super Admin creado o actualizado en ${process.env.DB_NAME}: ${email}.`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  run().catch((error) => {
    console.error('No se pudo crear o actualizar Super Admin:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { assertSuperAdminAccount, run };
