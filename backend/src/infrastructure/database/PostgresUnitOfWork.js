const {PostgresCommerceRepository}=require('../repositories/PostgresCommerceRepository');
const {PostgresOrderRepository}=require('../repositories/PostgresOrderRepository');
const {PostgresProductRepository}=require('../repositories/PostgresProductRepository');
const {PostgresProductRequestRepository}=require('../repositories/PostgresProductRequestRepository');
const {translatePersistenceError}=require('./persistenceErrors');
const {PostgresUserRepository}=require('../repositories/PostgresUserRepository');
class PostgresUnitOfWork {
  constructor(pool){this.pool=pool;}
  async run(work){
    const connection=await this.pool.connect();
    try{
      await connection.query('BEGIN');
      const result=await work({users:new PostgresUserRepository(connection),commerce:new PostgresCommerceRepository(connection),orders:new PostgresOrderRepository(connection),products:new PostgresProductRepository(connection),productRequests:new PostgresProductRequestRepository(connection)});
      await connection.query('COMMIT');return result;
    }catch(error){await connection.query('ROLLBACK');throw translatePersistenceError(error);}finally{connection.release();}
  }
}
module.exports={PostgresUnitOfWork};
