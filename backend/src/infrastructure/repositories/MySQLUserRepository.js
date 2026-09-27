const { USER_STATUSES } = require('../../domain/user');

class MySQLUserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByEmail(email) {
    const [rows] = await this.pool.execute(
      `SELECT id, name, email, password_hash AS passwordHash, role, status
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email],
    );

    return rows[0] || null;
  }

  async create(user) {
    const [result] = await this.pool.execute(
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
    const [rows] = await this.pool.execute(
      `SELECT id, name, email, role, status
       FROM users
       WHERE status = ?
       ORDER BY created_at ASC, id ASC`,
      [USER_STATUSES.PENDING],
    );

    return rows;
  }

  async updatePendingStatus(id, status) {
    const [result] = await this.pool.execute(
      'UPDATE users SET status = ? WHERE id = ? AND status = ?',
      [status, id, USER_STATUSES.PENDING],
    );

    if (result.affectedRows === 1) {
      return { updated: true, id, status };
    }

    const [rows] = await this.pool.execute(
      'SELECT id, status FROM users WHERE id = ? LIMIT 1',
      [id],
    );

    return rows[0] ? { updated: false, id: rows[0].id, status: rows[0].status } : null;
  }
}

module.exports = { MySQLUserRepository };
