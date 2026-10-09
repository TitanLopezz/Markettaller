const {BcryptPasswordHasher}=require('../src/infrastructure/services/BcryptPasswordHasher');
const {NodeCryptoService}=require('../src/infrastructure/services/NodeCryptoService');
const {JwtTokenService}=require('../src/infrastructure/services/JwtTokenService');
const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createRegisterUser } = require('../src/application/use-cases/registerUser');
const { createLoginUser } = require('../src/application/use-cases/loginUser');
const { createApp } = require('../src/infrastructure/http/app');
const { normalizeRole, verifyToken, verifyRole } = require('../src/infrastructure/http/middleware/authMiddleware');
const { createCreateProduct } = require('../src/application/use-cases/createProduct');
const { createCreateOrder } = require('../src/application/use-cases/createOrder');

test('registration hashes the password and creates a pending user with the selected role', async () => {
  let persistedUser;
  const registerUser = createRegisterUser({ passwordHasher:new BcryptPasswordHasher(),crypto:new NodeCryptoService(),
    userRepository: {
      create: async (user) => {
        persistedUser = user;
        return { id: 1, name: user.name, email: user.email, role: user.role, status: user.status };
      },
    },
  });

  const user = await registerUser({
    name: 'Ada Lovelace',
    email: 'ADA@example.com',
    password: 'secret123',
    role: 'gestor',
  });

  assert.equal(user.email, 'ada@example.com');
  assert.equal(user.role, 'gestor');
  assert.equal(user.status, 'pendiente');
  assert.notEqual(persistedUser.passwordHash, 'secret123');
  assert.equal(await bcrypt.compare('secret123', persistedUser.passwordHash), true);
});

test('pending users are denied and approved users receive a signed token', async () => {
  const passwordHash = await bcrypt.hash('secret123', 4);
  let status = 'pendiente';
  const userRepository = {
    findByEmail: async () => ({
      id: 7,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      passwordHash,
      role: 'gestor',
      status,
    }),
  };
  const loginUser = createLoginUser({ userRepository,passwordHasher:new BcryptPasswordHasher(),tokenService:new JwtTokenService('test-secret') });

  await assert.rejects(
    loginUser({ email: 'ada@example.com', password: 'secret123' }),
    { code: 'FORBIDDEN', message: 'Cuenta pendiente de autorización' },
  );

  status = 'aprobado';
  const result = await loginUser({ email: 'ada@example.com', password: 'secret123' });

  assert.equal(jwt.verify(result.token, 'test-secret').sub, 7);
  assert.equal(result.user.status, 'aprobado');
});

test('development CORS allows the alternate Vite port', async (context) => {
  const app = createApp({ registerUser: async () => ({}), loginUser: async () => ({}) });
  const server = app.listen(0);
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/users/register`, {
    method: 'OPTIONS',
    headers: {
      origin: 'http://127.0.0.1:5174',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });

  assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5174');
});

test('JWT middleware validates bearer tokens and normalizes role labels', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'middleware-test-secret';
  const token = jwt.sign({ sub: 42, role: 'gestor' }, process.env.JWT_SECRET);
  const req = { get: () => `Bearer ${token}` };
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;

  verifyToken(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.user.id, 42);
  assert.equal(normalizeRole('Gestor de Productos'), 'gestor');

  let forbiddenStatus;
  const forbiddenResponse = {
    status(code) { forbiddenStatus = code; return this; },
    json() { return this; },
  };
  verifyRole(['Super Admin'])({ user: req.user }, forbiddenResponse, () => {});
  assert.equal(forbiddenStatus, 403);

  if (previousSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousSecret;
  }
});

test('product creation validates values and passes normalized fields to the repository', async () => {
  let savedProduct;
  const createProduct = createCreateProduct({
    productRepository: {
      create: async (product) => {
        savedProduct = product;
        return { id: 5, ...product };
      },
    },
  });
  const product = await createProduct({
    nombre: '  Café  ',
    descripcion: ' Grano tostado ',
    precio: '12.50',
    categoria: 'Bebidas',
    imagen_url: '',
    stock: '8',
  });

  assert.equal(product.nombre, 'Café');
  assert.equal(product.precio, 12.5);
  assert.equal(savedProduct.imagen_url, null);

  await assert.rejects(
    createProduct({ nombre: 'Café', categoria: 'Bebidas', precio: -1, stock: 1 }),
    { code: 'VALIDATION' },
  );

  const productWithImage = await createProduct({
    nombre: 'Teclado',
    categoria: 'Tecnología',
    precio: 20,
    stock: 1,
    imagen_url: 'https://images.example.test/keyboard.png',
  });
  assert.equal(productWithImage.imagen_url, 'https://images.example.test/keyboard.png');

  await assert.rejects(
    createProduct({ nombre: 'Teclado', categoria: 'Tecnología', precio: 20, stock: 1, imagen_url: 'javascript:alert(1)' }),
    { code: 'VALIDATION', message: 'La URL de imagen debe usar HTTP o HTTPS.' },
  );
  await assert.rejects(
    createProduct({ nombre: 'Teclado', categoria: 'Tecnología', precio: 20, stock: 1, imagen_url: 'not a URL' }),
    { code: 'VALIDATION' },
  );
});

test('HTTP routes enforce read, write, and Super Admin roles', async (context) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'route-test-secret';
  let directProductCreates = 0;
  let directProductDeletes = 0;
  let submittedProductRequest;
  const app = createApp({
    registerUser: async () => ({}),
    loginUser: async () => ({}),
    listPendingUsers: async () => [{ id: 9, name: 'Pending', email: 'pending@example.test', role: 'gestor' }],
    updateUserStatus: async ({ id, status }) => ({ id: Number(id), status }),
    listProducts: async () => [],
    createProduct: async (product) => {
      directProductCreates += 1;
      return { id: 1, ...product };
    },
    updateProduct: async (product) => product,
    deleteProduct: async (id) => {
      directProductDeletes += 1;
      return { id: Number(id) };
    },
    createProductRequest: async (requestData) => {
      submittedProductRequest = requestData;
      return { id: 4, ...requestData };
    },
    listPendingProductRequests: async () => [{ id: 4, request_type: 'crear' }],
    updateProductRequestStatus: async ({ id, status }) => ({ id: Number(id), status }),
  });
  const server = app.listen(0);
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  });
  await new Promise((resolve) => server.once('listening', resolve));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = (path, role, method = 'GET', body) => fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(role ? { Authorization: `Bearer ${jwt.sign({ sub: 1, role }, process.env.JWT_SECRET)}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  assert.equal((await request('/api/users/pending')).status, 401);
  assert.equal((await request('/api/users/pending', 'gestor')).status, 403);
  assert.equal((await request('/api/users/pending', 'super_admin')).status, 200);
  assert.equal((await request('/api/products', 'proveedor')).status, 200);
  assert.equal((await request('/api/products', 'proveedor', 'POST', { nombre: 'x' })).status, 403);
  const createRequest = await request('/api/products', 'gestor', 'POST', { nombre: 'x' });
  assert.equal(createRequest.status, 202);
  assert.equal(submittedProductRequest.requestType, 'crear');
  assert.equal(directProductCreates, 0);
  assert.equal((await request('/api/products', 'super_admin', 'POST', { nombre: 'x' })).status, 201);
  assert.equal(directProductCreates, 1);
  const deleteRequest = await request('/api/products/8', 'gestor', 'DELETE');
  assert.equal(deleteRequest.status, 202);
  assert.equal(submittedProductRequest.requestType, 'eliminar');
  assert.equal(directProductDeletes, 0);
  assert.equal((await request('/api/products/requests/pending', 'gestor')).status, 403);
  assert.equal((await request('/api/products/requests/pending', 'super_admin')).status, 200);
  assert.equal((await request('/api/products/requests/4/status', 'gestor', 'PATCH', { status: 'aprobado' })).status, 403);
  assert.equal((await request('/api/products/requests/4/status', 'super_admin', 'PATCH', { status: 'aprobado' })).status, 200);
  assert.equal((await request('/api/products/8', 'super_admin', 'DELETE')).status, 200);
  assert.equal(directProductDeletes, 1);
});

test('order creation validates quantity and always starts pending', async () => {
  let savedOrder;
  const createOrder = createCreateOrder({
    orderRepository: {
      create: async (order) => {
        savedOrder = order;
        return { id: 3, ...order };
      },
    },
  });

  const order = await createOrder({ providerId: '12', productId: '8', quantity: '4' });
  assert.equal(order.providerId, 12);
  assert.equal(order.productId, 8);
  assert.equal(order.quantity, 4);
  assert.equal(savedOrder.status, 'pendiente');
  await assert.rejects(
    createOrder({ providerId: 12, productId: 8, quantity: 0 }),
    { code: 'VALIDATION' },
  );
});

test('order routes derive provider identity from JWT and restrict approvals to Super Admin', async (context) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'order-route-test-secret';
  let submittedOrder;
  let requestedProviderId;
  const app = createApp({
    registerUser: async () => ({}),
    loginUser: async () => ({}),
    listPendingUsers: async () => [],
    updateUserStatus: async () => ({}),
    listProducts: async () => [],
    createProduct: async () => ({}),
    updateProduct: async () => ({}),
    deleteProduct: async () => ({}),
    createOrder: async (order) => {
      submittedOrder = order;
      return { id: 20, ...order };
    },
    listMyOrders: async (providerId) => {
      requestedProviderId = providerId;
      return [{ user_id: providerId }];
    },
    listPendingOrders: async () => [{ id: 20, status: 'pendiente' }],
    updateOrderStatus: async ({ id, status }) => ({ id: Number(id), status }),
  });
  const server = app.listen(0);
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  });
  await new Promise((resolve) => server.once('listening', resolve));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = (path, role, method = 'GET', body, userId = 42) => fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(role ? { Authorization: `Bearer ${jwt.sign({ sub: userId, role }, process.env.JWT_SECRET)}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  assert.equal((await request('/api/orders/my-orders')).status, 401);
  const createResponse = await request(
    '/api/orders',
    'proveedor',
    'POST',
    { product_id: 8, quantity: 4, user_id: 999, status: 'aprobado' },
  );
  assert.equal(createResponse.status, 201);
  assert.equal(submittedOrder.providerId, 42);
  assert.equal(submittedOrder.productId, 8);
  assert.equal(submittedOrder.quantity, 4);

  await request('/api/orders/my-orders', 'proveedor', 'GET', undefined, 77);
  assert.equal(requestedProviderId, 77);
  assert.equal((await request('/api/orders/pending', 'proveedor')).status, 403);
  assert.equal((await request('/api/orders/pending', 'super_admin')).status, 200);
  assert.equal((await request('/api/orders/20/status', 'gestor', 'PATCH', { status: 'aprobado' })).status, 403);
  assert.equal((await request('/api/orders/20/status', 'super_admin', 'PATCH', { status: 'aprobado' })).status, 200);
});

test('Orders routes ignore body user_id and scope provider history to JWT identity', async (context) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'orders-identity-test-secret';
  let submittedOrder;
  let requestedProviderId;
  const app = createApp({
    registerUser: async () => ({}),
    loginUser: async () => ({}),
    listPendingUsers: async () => [],
    updateUserStatus: async () => ({}),
    listProducts: async () => [],
    createProduct: async () => ({}),
    updateProduct: async () => ({}),
    deleteProduct: async () => ({}),
    createOrder: async (order) => {
      submittedOrder = order;
      return { id: 5, ...order };
    },
    listMyOrders: async (providerId) => {
      requestedProviderId = providerId;
      return [{ user_id: providerId, product_name: 'Producto' }];
    },
    listPendingOrders: async () => [{ id: 5, status: 'pendiente' }],
    updateOrderStatus: async ({ id, status }) => ({ id: Number(id), status }),
  });
  const server = app.listen(0);
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  });
  await new Promise((resolve) => server.once('listening', resolve));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = (path, role, method = 'GET', body, userId = 42) => fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(role ? { Authorization: `Bearer ${jwt.sign({ sub: userId, role }, process.env.JWT_SECRET)}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  assert.equal((await request('/api/orders', undefined, 'POST', { product_id: 8, quantity: 3 })).status, 401);
  const created = await request(
    '/api/orders',
    'proveedor',
    'POST',
    { product_id: 8, quantity: 3, user_id: 999, status: 'aprobado' },
  );
  assert.equal(created.status, 201);
  assert.equal(submittedOrder.providerId, 42);
  assert.equal(Object.hasOwn(submittedOrder, 'user_id'), false);

  const history = await request('/api/orders/my-orders', 'proveedor', 'GET', undefined, 77);
  assert.equal(history.status, 200);
  assert.equal(requestedProviderId, 77);
  assert.equal((await history.json())[0].user_id, 77);
  assert.equal((await request('/api/orders/pending', 'proveedor')).status, 403);
  assert.equal((await request('/api/orders/pending', 'super_admin')).status, 200);
  assert.equal((await request('/api/orders/5/status', 'gestor', 'PATCH', { status: 'aprobado' })).status, 403);
  assert.equal((await request('/api/orders/5/status', 'super_admin', 'PATCH', { status: 'aprobado' })).status, 200);
});
