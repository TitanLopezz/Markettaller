const PRODUCT_COLUMNS = 'id, nombre, descripcion, precio, categoria, imagen_url, stock';

class MySQLProductRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll() {
    const [rows] = await this.pool.execute(
      `SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY nombre ASC, id ASC`,
    );
    return rows;
  }

  async create(product) {
    const [result] = await this.pool.execute(
      `INSERT INTO products (nombre, descripcion, precio, categoria, imagen_url, stock)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [product.nombre, product.descripcion, product.precio, product.categoria, product.imagen_url, product.stock],
    );
    return { id: result.insertId, ...product };
  }

  async update(id, product) {
    await this.pool.execute(
      `UPDATE products
       SET nombre = ?, descripcion = ?, precio = ?, categoria = ?, imagen_url = ?, stock = ?
       WHERE id = ?`,
      [product.nombre, product.descripcion, product.precio, product.categoria, product.imagen_url, product.stock, id],
    );
    return this.findById(id);
  }

  async findById(id) {
    const [rows] = await this.pool.execute(
      `SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  }

  async delete(id) {
    const [result] = await this.pool.execute('DELETE FROM products WHERE id = ?', [id]);
    return result.affectedRows === 1;
  }
}

module.exports = { MySQLProductRepository };
