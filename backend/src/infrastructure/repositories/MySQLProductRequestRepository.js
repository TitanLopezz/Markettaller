const PRODUCT_FIELDS = ['nombre', 'descripcion', 'precio', 'categoria', 'imagen_url', 'stock'];

const parseProductData = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

class MySQLProductRequestRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ requesterId, requestType, productId = null, productData }) {
    const [result] = await this.pool.execute(
      `INSERT INTO product_requests (requester_id, request_type, product_id, product_data)
       VALUES (?, ?, ?, ?)`,
      [requesterId, requestType, productId, JSON.stringify(productData)],
    );

    return {
      id: result.insertId,
      requester_id: requesterId,
      request_type: requestType,
      product_id: productId,
      product_data: productData,
      status: 'pendiente',
    };
  }

  async hasPendingDelete(productId) {
    const [rows] = await this.pool.execute(
      `SELECT id FROM product_requests
       WHERE product_id = ? AND request_type = 'eliminar' AND status = 'pendiente'
       LIMIT 1`,
      [productId],
    );
    return rows.length > 0;
  }

  async findPending() {
    const [rows] = await this.pool.execute(
      `SELECT r.id, r.requester_id, u.name AS requester_name, u.email AS requester_email,
              r.request_type, r.product_id, r.product_data, r.status, r.created_at
       FROM product_requests r
       INNER JOIN users u ON u.id = r.requester_id
       WHERE r.status = 'pendiente'
       ORDER BY r.created_at ASC, r.id ASC`,
    );

    return rows.map((row) => ({ ...row, product_data: parseProductData(row.product_data) }));
  }

  async updatePendingStatus(id, status, reviewerId) {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT id, request_type, product_id, product_data, status
         FROM product_requests WHERE id = ? FOR UPDATE`,
        [id],
      );
      const request = rows[0];

      if (!request) {
        await connection.rollback();
        return null;
      }

      if (request.status !== 'pendiente') {
        await connection.rollback();
        return { updated: false, id: request.id, status: request.status };
      }

      const productData = parseProductData(request.product_data);
      if (status === 'aprobado' && request.request_type === 'crear') {
        await connection.execute(
          `INSERT INTO products (${PRODUCT_FIELDS.join(', ')})
           VALUES (?, ?, ?, ?, ?, ?)`,
          PRODUCT_FIELDS.map((field) => productData[field]),
        );
      }

      if (status === 'aprobado' && request.request_type === 'eliminar') {
        const [deleteResult] = await connection.execute(
          'DELETE FROM products WHERE id = ?',
          [request.product_id],
        );
        if (deleteResult.affectedRows !== 1) {
          const error = new Error('El producto de la solicitud ya no existe.');
          error.statusCode = 404;
          throw error;
        }
      }

      await connection.execute(
        `UPDATE product_requests
         SET status = ?, reviewer_id = ?, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'pendiente'`,
        [status, reviewerId, id],
      );
      await connection.commit();

      return {
        updated: true,
        id: request.id,
        status,
        requestType: request.request_type,
        product: productData,
      };
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        const conflict = new Error('No se puede eliminar el producto porque tiene pedidos asociados.');
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = { MySQLProductRequestRepository };