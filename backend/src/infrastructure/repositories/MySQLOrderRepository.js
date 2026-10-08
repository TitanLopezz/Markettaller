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
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      const [orders] = await connection.execute(
        `SELECT id, product_id, quantity, status
         FROM orders
         WHERE id = ?
         FOR UPDATE`,
        [id],
      );
      const order = orders[0];

      if (!order) {
        await connection.rollback();
        return null;
      }

      if (order.status !== ORDER_STATUSES.PENDING) {
        await connection.rollback();
        return { updated: false, id: order.id, status: order.status };
      }

      if (status === ORDER_STATUSES.APPROVED) {
        const [products] = await connection.execute(
          'SELECT id, stock FROM products WHERE id = ? FOR UPDATE',
          [order.product_id],
        );
        const product = products[0];

        if (!product) {
          const error = new Error('El producto del pedido ya no existe.');
          error.statusCode = 404;
          throw error;
        }

        if (Number(product.stock) < Number(order.quantity)) {
          const error = new Error('Stock insuficiente para aprobar el pedido.');
          error.statusCode = 409;
          throw error;
        }

        const [stockUpdate] = await connection.execute(
          'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
          [order.quantity, order.product_id, order.quantity],
        );

        if (stockUpdate.affectedRows !== 1) {
          const error = new Error('Stock insuficiente para aprobar el pedido.');
          error.statusCode = 409;
          throw error;
        }
      }

      await connection.execute(
        'UPDATE orders SET status = ? WHERE id = ? AND status = ?',
        [status, id, ORDER_STATUSES.PENDING],
      );
      await connection.commit();
      return { updated: true, id: order.id, status };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = { MySQLOrderRepository };
