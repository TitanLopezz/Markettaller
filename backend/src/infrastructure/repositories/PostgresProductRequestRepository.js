const {execute}=require('../database/persistenceErrors');

const parseProductData = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

class PostgresProductRequestRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ requesterId, requestType, productId = null, productData }) {
    const [result] = await execute(this.pool,
      `INSERT INTO product_requests (requester_id, request_type, product_id, product_data)
       VALUES ($1, $2, $3, $4) RETURNING id`,
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
    const [rows] = await execute(this.pool,
      `SELECT id FROM product_requests
       WHERE product_id = $1 AND request_type = 'eliminar' AND status = 'pendiente'
       LIMIT 1`,
      [productId],
    );
    return rows.length > 0;
  }

  async findPending() {
    const [rows] = await execute(this.pool,
      `SELECT r.id, r.requester_id, u.name AS requester_name, u.email AS requester_email,
              r.request_type, r.product_id, r.product_data, r.status, r.created_at
       FROM product_requests r
       INNER JOIN users u ON u.id = r.requester_id
       WHERE r.status = 'pendiente'
       ORDER BY r.created_at ASC, r.id ASC`,
    );

    return rows.map((row) => ({ ...row, product_data: parseProductData(row.product_data) }));
  }

  async lockById(id) {
    const [rows]=await execute(this.pool,'SELECT id, request_type, product_id, product_data, status FROM product_requests WHERE id = $1 FOR UPDATE',[id]);
    return rows[0]?{...rows[0],product_data:parseProductData(rows[0].product_data)}:null;
  }
  setStatus(id,status,reviewerId) {return execute(this.pool, 'UPDATE product_requests SET status = $1, reviewer_id = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $3 AND status = \'pendiente\'',[status,reviewerId,id]);}
}
module.exports={PostgresProductRequestRepository};
