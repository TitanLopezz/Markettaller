const {execute}=require('../database/persistenceErrors');
const PRODUCT_COLUMNS = 'id, nombre, descripcion, precio, categoria, imagen_url, stock';

class PostgresProductRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll() {
    const [rows] = await execute(this.pool,
      `SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY nombre ASC, id ASC`,
    );
    return rows;
  }

  async create(product) {
    const [result] = await execute(this.pool,
      `INSERT INTO products (nombre, descripcion, precio, categoria, imagen_url, stock)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [product.nombre, product.descripcion, product.precio, product.categoria, product.imagen_url, product.stock],
    );
    return { id: result.insertId, ...product };
  }

  async update(id, product) {
    await execute(this.pool,
      `UPDATE products
       SET nombre = $1, descripcion = $2, precio = $3, categoria = $4, imagen_url = $5, stock = $6
       WHERE id = $7`,
      [product.nombre, product.descripcion, product.precio, product.categoria, product.imagen_url, product.stock, id],
    );
    return this.findById(id);
  }

  async findById(id) {
    const [rows] = await execute(this.pool,
      `SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1 LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  }

  async lockInventoryById(id) {const [rows]=await execute(this.pool,'SELECT id, stock FROM products WHERE id = $1 FOR UPDATE',[id]);return rows[0]||null;}
  async decreaseStock(id,quantity) {const [result]=await execute(this.pool,'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $3',[quantity,id,quantity]);return result.affectedRows===1;}
  async delete(id) {
    const [result] = await execute(this.pool,'DELETE FROM products WHERE id = $1', [id]);
    return result.affectedRows === 1;
  }
}

module.exports = { PostgresProductRepository };
