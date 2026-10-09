const {MySQLCommerceRepository}=require('../repositories/MySQLCommerceRepository');
const {MySQLOrderRepository}=require('../repositories/MySQLOrderRepository');
const {MySQLProductRepository}=require('../repositories/MySQLProductRepository');
const {MySQLProductRequestRepository}=require('../repositories/MySQLProductRequestRepository');
const {translatePersistenceError}=require('./persistenceErrors');
const {MySQLUserRepository}=require('../repositories/MySQLUserRepository');
class MySQLUnitOfWork {
  constructor(pool){this.pool=pool;}
  async run(work){
    const connection=await this.pool.getConnection();
    try{
      await connection.beginTransaction();
      const result=await work({users:new MySQLUserRepository(connection),commerce:new MySQLCommerceRepository(connection),orders:new MySQLOrderRepository(connection),products:new MySQLProductRepository(connection),productRequests:new MySQLProductRequestRepository(connection)});
      await connection.commit();return result;
    }catch(error){await connection.rollback();throw translatePersistenceError(error);}finally{connection.release();}
  }
}
module.exports={MySQLUnitOfWork};
