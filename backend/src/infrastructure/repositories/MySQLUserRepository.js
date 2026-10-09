const {execute}=require('../database/persistenceErrors');
const { USER_STATUSES } = require('../../domain/user');

class MySQLUserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByEmail(email) {
    const [rows] = await execute(this.pool,
      `SELECT u.id, u.name, u.email, u.password_hash AS passwordHash, u.role, u.status,
              COALESCE(s.version, 0) AS authVersion
       FROM users u LEFT JOIN user_security s ON s.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [email],
    );

    return rows[0] || null;
  }

  async findById(id) {
    const [rows] = await execute(this.pool,`SELECT u.id, u.role, u.status, COALESCE(s.version, 0) AS authVersion
      FROM users u LEFT JOIN user_security s ON s.user_id = u.id WHERE u.id = ?`, [id]);
    return rows[0] || null;
  }

  async findByEmailForUpdate(email){const [rows]=await execute(this.pool,'SELECT id, role FROM users WHERE email=? LIMIT 1 FOR UPDATE',[email]);return rows[0]||null;}
  upsertSuperAdmin(user){return execute(this.pool,`INSERT INTO users (name,email,password_hash,role,status) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),password_hash=VALUES(password_hash),status=VALUES(status)`,[user.name,user.email,user.passwordHash,user.role,user.status]);}
  invalidateSessions(id){return execute(this.pool,'INSERT INTO user_security (user_id,version) VALUES (?,1) ON DUPLICATE KEY UPDATE version=version+1',[id]);}

  async create(user) {
    const [result] = await execute(this.pool,
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      [user.name, user.email, user.passwordHash, user.role, user.status],
    );

    return {
      id: result.insertId,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }

  async findPending() {
    const [rows] = await execute(this.pool,
      `SELECT id, name, email, role, status
       FROM users
       WHERE status = ?
       ORDER BY created_at ASC, id ASC`,
      [USER_STATUSES.PENDING],
    );

    return rows;
  }

  async updatePendingStatus(id, status) {
    const [result] = await execute(this.pool,
      'UPDATE users SET status = ? WHERE id = ? AND status = ?',
      [status, id, USER_STATUSES.PENDING],
    );

    if (result.affectedRows === 1) {
      return { updated: true, id, status };
    }

    const [rows] = await execute(this.pool,
      'SELECT id, status FROM users WHERE id = ? LIMIT 1',
      [id],
    );

    return rows[0] ? { updated: false, id: rows[0].id, status: rows[0].status } : null;
  }
}

module.exports = { MySQLUserRepository };
