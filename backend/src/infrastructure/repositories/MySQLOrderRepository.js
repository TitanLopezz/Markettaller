const { ORDER_STATUSES } = require('../../domain/order');

class MySQLOrderRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ providerId, productId, quantity }) {
    const [result] = await this.pool.execute(
      `INSERT INTO orders (user_id, product_id, quantity, status)
       VALUES (?, ?, ?, ?)`,
      [providerId, productId, quantity, ORDER_STATUSES.PENDING],
    );
    const [rows] = await this.pool.execute(
      `SELECT id, user_id, product_id, quantity, status, created_at
       FROM orders WHERE id = ? LIMIT 1`,
      [result.insertId],
    );
    return rows[0];
  }

  async findByProviderId(providerId) {
    const [rows] = await this.pool.execute(
      `SELECT o.id, o.user_id, o.product_id, o.quantity, o.status, o.created_at,
              p.nombre AS product_name, p.imagen_url AS product_image_url
       FROM orders o
       INNER JOIN products p ON p.id = o.product_id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC, o.id DESC`,
      [providerId],
    );
    return rows;
  }

  async findPending() {
    const [rows] = await this.pool.execute(
      `SELECT o.id, o.user_id, u.name AS provider_name, u.email AS provider_email,
              o.product_id, p.nombre AS product_name, p.imagen_url AS product_image_url,
              o.quantity, o.status, o.created_at
       FROM orders o
       INNER JOIN users u ON u.id = o.user_id
       INNER JOIN products p ON p.id = o.product_id
       WHERE o.status = ?
       ORDER BY o.created_at ASC, o.id ASC`,
      [ORDER_STATUSES.PENDING],
    );
    return rows;
  }

  async updatePendingStatus(id, status) {
    const [result] = await this.pool.execute(
      'UPDATE orders SET status = ? WHERE id = ? AND status = ?',
      [status, id, ORDER_STATUSES.PENDING],
    );

    if (result.affectedRows === 1) {
      return { updated: true, id, status };
    }

    const [rows] = await this.pool.execute(
      'SELECT id, status FROM orders WHERE id = ? LIMIT 1',
      [id],
    );
    return rows[0] ? { updated: false, id: rows[0].id, status: rows[0].status } : null;
  }
}

module.exports = { MySQLOrderRepository };
