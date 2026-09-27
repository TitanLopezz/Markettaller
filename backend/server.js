const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { createApp } = require('./src/infrastructure/http/app');
const { createMySQLPool } = require('./src/infrastructure/database/mysqlPool');
const { MySQLUserRepository } = require('./src/infrastructure/repositories/MySQLUserRepository');
const { MySQLProductRepository } = require('./src/infrastructure/repositories/MySQLProductRepository');
const { MySQLProductRequestRepository } = require('./src/infrastructure/repositories/MySQLProductRequestRepository');
const { MySQLOrderRepository } = require('./src/infrastructure/repositories/MySQLOrderRepository');
const { createRegisterUser } = require('./src/application/use-cases/registerUser');
const { createLoginUser } = require('./src/application/use-cases/loginUser');
const { createListPendingUsers } = require('./src/application/use-cases/listPendingUsers');
const { createUpdateUserStatus } = require('./src/application/use-cases/updateUserStatus');
const { createListProducts } = require('./src/application/use-cases/listProducts');
const { createCreateProduct } = require('./src/application/use-cases/createProduct');
const { createUpdateProduct } = require('./src/application/use-cases/updateProduct');
const { createDeleteProduct } = require('./src/application/use-cases/deleteProduct');
const { createCreateProductRequest } = require('./src/application/use-cases/createProductRequest');
const { createListPendingProductRequests } = require('./src/application/use-cases/listPendingProductRequests');
const { createUpdateProductRequestStatus } = require('./src/application/use-cases/updateProductRequestStatus');
const { createCreateOrder } = require('./src/application/use-cases/createOrder');
const { createListMyOrders } = require('./src/application/use-cases/listMyOrders');
const { createListPendingOrders } = require('./src/application/use-cases/listPendingOrders');
const { createUpdateOrderStatus } = require('./src/application/use-cases/updateOrderStatus');

const start = async () => {
  const pool = createMySQLPool();
  await pool.query('SELECT 1');

  const userRepository = new MySQLUserRepository(pool);
  const productRepository = new MySQLProductRepository(pool);
  const productRequestRepository = new MySQLProductRequestRepository(pool);
  const orderRepository = new MySQLOrderRepository(pool);
  const registerUser = createRegisterUser({ userRepository });
  const loginUser = createLoginUser({ userRepository, jwtSecret: process.env.JWT_SECRET });
  const listPendingUsers = createListPendingUsers({ userRepository });
  const updateUserStatus = createUpdateUserStatus({ userRepository });
  const listProducts = createListProducts({ productRepository });
  const createProduct = createCreateProduct({ productRepository });
  const updateProduct = createUpdateProduct({ productRepository });
  const deleteProduct = createDeleteProduct({ productRepository });
  const createProductRequest = createCreateProductRequest({ productRepository, productRequestRepository });
  const listPendingProductRequests = createListPendingProductRequests({ productRequestRepository });
  const updateProductRequestStatus = createUpdateProductRequestStatus({ productRequestRepository });
  const createOrder = createCreateOrder({ orderRepository });
  const listMyOrders = createListMyOrders({ orderRepository });
  const listPendingOrders = createListPendingOrders({ orderRepository });
  const updateOrderStatus = createUpdateOrderStatus({ orderRepository });
  const app = createApp({
    registerUser,
    loginUser,
    listPendingUsers,
    updateUserStatus,
    listProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    createProductRequest,
    listPendingProductRequests,
    updateProductRequestStatus,
    createOrder,
    listMyOrders,
    listPendingOrders,
    updateOrderStatus,
  });
  const port = Number(process.env.PORT || 3000);

  app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error('No se pudo iniciar el servidor:', error.message);
  process.exitCode = 1;
});
