const {execute}=require('../database/persistenceErrors');
const json=value=>typeof value==='string'?JSON.parse(value):value;
class MySQLCommerceRepository {
  constructor(connection){this.connection=connection;}
  async rows(sql,params=[]){return (await execute(this.connection,sql,params))[0];}
  async one(sql,params=[]){return (await this.rows(sql,params))[0]||null;}
  findUser(id){return this.one('SELECT id, role, status, email FROM users WHERE id=?',[id]);}
  findUserByEmail(email){return this.one('SELECT id, email FROM users WHERE email=?',[email]);}
  lockUser(id){return this.one('SELECT id FROM users WHERE id=? FOR UPDATE',[id]);}
  findRequest(userId,key){return this.one('SELECT id, request_hash FROM shop_orders WHERE user_id=? AND request_key=?',[userId,key]);}
  lockProduct(id){return this.one('SELECT id, nombre, imagen_url, precio, stock FROM products WHERE id=? FOR UPDATE',[id]);}
  async insertOrder(userId,data,subtotal,shipping){const result=await this.rows(`INSERT INTO shop_orders (user_id, request_key, request_hash, subtotal_cents, shipping_cents, total_cents, address, payment_method) VALUES (?,?,?,?,?,?,?,?)`,[userId,data.request_key,data.request_hash,subtotal,shipping,subtotal+shipping,JSON.stringify(data.address),data.payment_method]);return result.insertId;}
  changeStock(id,delta){return this.rows('UPDATE products SET stock=stock+? WHERE id=?',[delta,id]);}
  insertItem(id,item){return this.rows(`INSERT INTO shop_order_items (order_id,product_id,product_name,image_url,quantity,unit_price_cents) VALUES (?,?,?,?,?,?)`,[id,item.product_id,item.product.nombre,item.product.imagen_url,item.quantity,item.unit_price_cents]);}
  notify(userId,id,message){return this.rows('INSERT INTO shop_notifications (user_id,order_id,message) VALUES (?,?,?)',[userId,id,message]);}
  async findOrder(id){const order=await this.one('SELECT * FROM shop_orders WHERE id=?',[id]);return order?{...order,address:json(order.address)}:null;}
  lockOrder(id){return this.one('SELECT * FROM shop_orders WHERE id=? FOR UPDATE',[id]);}
  orderItems(id){return this.rows('SELECT * FROM shop_order_items WHERE order_id=? ORDER BY product_id,id',[id]);}
  fulfillment(id){return this.one('SELECT f.instructions,f.updated_at,u.name AS author_name FROM shop_fulfillment f JOIN users u ON u.id=f.updated_by WHERE f.order_id=?',[id]);}
  updateOrder(id,data){return this.rows('UPDATE shop_orders SET status=?,payment_status=?,carrier=?,tracking_number=? WHERE id=?',[data.status,data.payment_status,data.carrier,data.tracking_number,id]);}
  catalog(){return this.rows('SELECT id,nombre,descripcion,precio,categoria,imagen_url,stock FROM products ORDER BY nombre,id');}
  async listOrders(userId,staff,offset){const rows=await this.rows(`SELECT o.*,u.name AS customer_name FROM shop_orders o JOIN users u ON u.id=o.user_id ${staff?'':'WHERE o.user_id=?'} ORDER BY o.id DESC LIMIT 20 OFFSET ${offset}`,staff?[]:[userId]);return rows.map(row=>({...row,address:json(row.address)}));}
  saveFulfillment(id,userId,instructions){return this.rows('INSERT INTO shop_fulfillment (order_id,instructions,updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE instructions=VALUES(instructions),updated_by=VALUES(updated_by),updated_at=CURRENT_TIMESTAMP',[id,instructions,userId]);}
  async addresses(userId){return (await this.rows('SELECT id,address FROM customer_addresses WHERE user_id=? ORDER BY id DESC',[userId])).map(row=>({...row,address:json(row.address)}));}
  async addressCount(userId){return Number((await this.one('SELECT COUNT(*) AS count FROM customer_addresses WHERE user_id=?',[userId])).count);}
  async insertAddress(userId,address){const result=await this.rows('INSERT INTO customer_addresses (user_id,address) VALUES (?,?)',[userId,JSON.stringify(address)]);return {id:result.insertId,address};}
  deleteAddress(userId,id){return this.rows('DELETE FROM customer_addresses WHERE id=? AND user_id=?',[id,userId]);}
  notifications(userId){return this.rows('SELECT * FROM shop_notifications WHERE user_id=? ORDER BY id DESC LIMIT 100',[userId]);}
  readNotifications(userId){return this.rows('UPDATE shop_notifications SET is_read=TRUE WHERE user_id=?',[userId]);}
  deleteResetTokens(userId){return this.rows('DELETE FROM password_reset_tokens WHERE user_id=?',[userId]);}
  insertResetToken(hash,userId,expiresAt){return this.rows('INSERT INTO password_reset_tokens (token_hash,user_id,expires_at) VALUES (?,?,?)',[hash,userId,expiresAt]);}
  findResetToken(hash,lock=false){return this.one(`SELECT user_id,expires_at FROM password_reset_tokens WHERE token_hash=?${lock?' FOR UPDATE':''}`,[hash]);}
  updatePassword(userId,hash){return this.rows('UPDATE users SET password_hash=? WHERE id=?',[hash,userId]);}
  invalidateSessions(userId){return this.rows('INSERT INTO user_security (user_id,version) VALUES (?,1) ON DUPLICATE KEY UPDATE version=version+1',[userId]);}
}
module.exports={MySQLCommerceRepository};
