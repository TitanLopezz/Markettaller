const {execute}=require('../database/persistenceErrors');
const json=value=>typeof value==='string'?JSON.parse(value):value;
class PostgresCommerceRepository {
  constructor(connection){this.connection=connection;}
  async rows(sql,params=[]){return (await execute(this.connection,sql,params))[0];}
  async one(sql,params=[]){return (await this.rows(sql,params))[0]||null;}
  findUser(id){return this.one('SELECT id, role, status, email FROM users WHERE id=$1',[id]);}
  findUserByEmail(email){return this.one('SELECT id, email FROM users WHERE email=$1',[email]);}
  lockUser(id){return this.one('SELECT id FROM users WHERE id=$1 FOR UPDATE',[id]);}
  findRequest(userId,key){return this.one('SELECT id, request_hash FROM shop_orders WHERE user_id=$1 AND request_key=$2',[userId,key]);}
  lockProduct(id){return this.one('SELECT id, nombre, imagen_url, precio, stock FROM products WHERE id=$1 FOR UPDATE',[id]);}
  async insertOrder(userId,data,subtotal,shipping){const result=await this.rows(`INSERT INTO shop_orders (user_id, request_key, request_hash, subtotal_cents, shipping_cents, total_cents, address, payment_method) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[userId,data.request_key,data.request_hash,subtotal,shipping,subtotal+shipping,JSON.stringify(data.address),data.payment_method]);return result.insertId;}
  changeStock(id,delta){return this.rows('UPDATE products SET stock=stock+$1 WHERE id=$2',[delta,id]);}
  insertItem(id,item){return this.rows(`INSERT INTO shop_order_items (order_id,product_id,product_name,image_url,quantity,unit_price_cents) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,[id,item.product_id,item.product.nombre,item.product.imagen_url,item.quantity,item.unit_price_cents]);}
  notify(userId,id,message){return this.rows('INSERT INTO shop_notifications (user_id,order_id,message) VALUES ($1,$2,$3) RETURNING id',[userId,id,message]);}
  async findOrder(id){const order=await this.one('SELECT * FROM shop_orders WHERE id=$1',[id]);return order?{...order,address:json(order.address)}:null;}
  lockOrder(id){return this.one('SELECT * FROM shop_orders WHERE id=$1 FOR UPDATE',[id]);}
  orderItems(id){return this.rows('SELECT * FROM shop_order_items WHERE order_id=$1 ORDER BY product_id,id',[id]);}
  fulfillment(id){return this.one('SELECT f.instructions,f.updated_at,u.name AS author_name FROM shop_fulfillment f JOIN users u ON u.id=f.updated_by WHERE f.order_id=$1',[id]);}
  updateOrder(id,data){return this.rows('UPDATE shop_orders SET status=$1,payment_status=$2,carrier=$3,tracking_number=$4 WHERE id=$5',[data.status,data.payment_status,data.carrier,data.tracking_number,id]);}
  catalog(){return this.rows('SELECT id,nombre,descripcion,precio,categoria,imagen_url,stock FROM products ORDER BY nombre,id');}
  async listOrders(userId,staff,offset){const rows=await this.rows(`SELECT o.*,u.name AS customer_name FROM shop_orders o JOIN users u ON u.id=o.user_id ${staff?'':'WHERE o.user_id=$1'} ORDER BY o.id DESC LIMIT 20 OFFSET ${offset}`,staff?[]:[userId]);return rows.map(row=>({...row,address:json(row.address)}));}
  saveFulfillment(id,userId,instructions){return this.rows('INSERT INTO shop_fulfillment (order_id,instructions,updated_by) VALUES ($1,$2,$3) ON CONFLICT (order_id) DO UPDATE SET instructions=EXCLUDED.instructions,updated_by=EXCLUDED.updated_by,updated_at=CURRENT_TIMESTAMP',[id,instructions,userId]);}
  async addresses(userId){return (await this.rows('SELECT id,address FROM customer_addresses WHERE user_id=$1 ORDER BY id DESC',[userId])).map(row=>({...row,address:json(row.address)}));}
  async addressCount(userId){return Number((await this.one('SELECT COUNT(*) AS count FROM customer_addresses WHERE user_id=$1',[userId])).count);}
  async insertAddress(userId,address){const result=await this.rows('INSERT INTO customer_addresses (user_id,address) VALUES ($1,$2) RETURNING id',[userId,JSON.stringify(address)]);return {id:result.insertId,address};}
  deleteAddress(userId,id){return this.rows('DELETE FROM customer_addresses WHERE id=$1 AND user_id=$2',[id,userId]);}
  notifications(userId){return this.rows('SELECT * FROM shop_notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 100',[userId]);}
  readNotifications(userId){return this.rows('UPDATE shop_notifications SET is_read=TRUE WHERE user_id=$1',[userId]);}
  deleteResetTokens(userId){return this.rows('DELETE FROM password_reset_tokens WHERE user_id=$1',[userId]);}
  insertResetToken(hash,userId,expiresAt){return this.rows('INSERT INTO password_reset_tokens (token_hash,user_id,expires_at) VALUES ($1,$2,$3)',[hash,userId,expiresAt]);}
  findResetToken(hash,lock=false){return this.one(`SELECT user_id,expires_at FROM password_reset_tokens WHERE token_hash=$1${lock?' FOR UPDATE':''}`,[hash]);}
  updatePassword(userId,hash){return this.rows('UPDATE users SET password_hash=$1 WHERE id=$2',[hash,userId]);}
  invalidateSessions(userId){return this.rows('INSERT INTO user_security (user_id,version) VALUES ($1,1) ON CONFLICT (user_id) DO UPDATE SET version=user_security.version+1',[userId]);}
}
module.exports={PostgresCommerceRepository};
