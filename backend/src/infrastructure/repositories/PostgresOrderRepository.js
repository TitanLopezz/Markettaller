const {execute}=require('../database/persistenceErrors');
const { ORDER_STATUSES } = require('../../domain/order');

class PostgresOrderRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ providerId, productId, quantity }) {
    const [result] = await execute(this.pool,
      `INSERT INTO orders (user_id, product_id, quantity, status)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [providerId, productId, quantity, ORDER_STATUSES.PENDING],
    );
    const [rows] = await execute(this.pool,
      `SELECT id, user_id, product_id, quantity, status, created_at
       FROM orders WHERE id = $1 LIMIT 1`,
      [result.insertId],
    );
    return rows[0];
  }

  async findByProviderId(providerId) {
    const [rows] = await execute(this.pool,
      `SELECT o.id, o.user_id, o.product_id, o.quantity, o.status, o.created_at,
              p.nombre AS product_name, p.imagen_url AS product_image_url
       FROM orders o
       INNER JOIN products p ON p.id = o.product_id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC, o.id DESC`,
      [providerId],
    );
    return rows;
  }

  async findPending() {
    const [rows] = await execute(this.pool,
      `SELECT o.id, o.user_id, u.name AS provider_name, u.email AS provider_email,
              o.product_id, p.nombre AS product_name, p.imagen_url AS product_image_url,
              o.quantity, o.status, o.created_at
       FROM orders o
       INNER JOIN users u ON u.id = o.user_id
       INNER JOIN products p ON p.id = o.product_id
       WHERE o.status = $1
       ORDER BY o.created_at ASC, o.id ASC`,
      [ORDER_STATUSES.PENDING],
    );
    return rows;
  }

  async lockById(id) {
    const [rows]=await execute(this.pool, 'SELECT id, product_id, quantity, status FROM orders WHERE id = $1 FOR UPDATE',[id]);
    return rows[0] || null;
  }
  setStatus(id,status) {return execute(this.pool,'UPDATE orders SET status = $1 WHERE id = $2 AND status = $3',[status,id,'pendiente']);}
}
module.exports={PostgresOrderRepository};
