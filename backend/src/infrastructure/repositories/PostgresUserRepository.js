const {execute}=require('../database/persistenceErrors');
const { USER_STATUSES } = require('../../domain/user');

class PostgresUserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByEmail(email) {
    const [rows] = await execute(this.pool,
      `SELECT u.id, u.name, u.email, u.password_hash AS "passwordHash", u.role, u.status,
              COALESCE(s.version, 0) AS "authVersion"
       FROM users u LEFT JOIN user_security s ON s.user_id = u.id
       WHERE u.email = $1
       LIMIT 1`,
      [email],
    );

    return rows[0] || null;
  }

  async findById(id) {
    const [rows] = await execute(this.pool,`SELECT u.id, u.role, u.status, COALESCE(s.version, 0) AS "authVersion"
      FROM users u LEFT JOIN user_security s ON s.user_id = u.id WHERE u.id = $1`, [id]);
    return rows[0] || null;
  }

  async findByEmailForUpdate(email){const [rows]=await execute(this.pool,'SELECT id, role FROM users WHERE email=$1 LIMIT 1 FOR UPDATE',[email]);return rows[0]||null;}
  upsertSuperAdmin(user){return execute(this.pool,`INSERT INTO users (name,email,password_hash,role,status) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,status=EXCLUDED.status WHERE users.role='super_admin' RETURNING id`,[user.name,user.email,user.passwordHash,user.role,user.status]);}
  invalidateSessions(id){return execute(this.pool,'INSERT INTO user_security (user_id,version) VALUES ($1,1) ON CONFLICT (user_id) DO UPDATE SET version=user_security.version+1',[id]);}

  async create(user) {
    const [result] = await execute(this.pool,
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
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
       WHERE status = $1
       ORDER BY created_at ASC, id ASC`,
      [USER_STATUSES.PENDING],
    );

    return rows;
  }

  async updatePendingStatus(id, status) {
    const [result] = await execute(this.pool,
      'UPDATE users SET status = $1 WHERE id = $2 AND status = $3',
      [status, id, USER_STATUSES.PENDING],
    );

    if (result.affectedRows === 1) {
      return { updated: true, id, status };
    }

    const [rows] = await execute(this.pool,
      'SELECT id, status FROM users WHERE id = $1 LIMIT 1',
      [id],
    );

    return rows[0] ? { updated: false, id: rows[0].id, status: rows[0].status } : null;
  }
}

module.exports = { PostgresUserRepository };
