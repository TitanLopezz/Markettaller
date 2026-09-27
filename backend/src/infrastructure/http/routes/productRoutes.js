const express = require('express');
const { createProductController } = require('../controllers/productController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

const PRODUCT_READ_ROLES = ['Super Admin', 'Gestor de Productos', 'Proveedor'];
const PRODUCT_WRITE_ROLES = ['Super Admin', 'Gestor de Productos'];

const createProductRouter = (useCases) => {
  const router = express.Router();
  const controller = createProductController(useCases);

  router.get('/requests/pending', verifyToken, verifyRole(['Super Admin']), controller.listPendingRequests);
  router.patch('/requests/:id/status', verifyToken, verifyRole(['Super Admin']), controller.updateProductRequestStatus);
  router.get('/', verifyToken, verifyRole(PRODUCT_READ_ROLES), controller.list);
  router.post('/', verifyToken, verifyRole(PRODUCT_WRITE_ROLES), controller.create);
  router.put('/:id', verifyToken, verifyRole(PRODUCT_WRITE_ROLES), controller.update);
  router.delete('/:id', verifyToken, verifyRole(PRODUCT_WRITE_ROLES), controller.delete);

  return router;
};

module.exports = { createProductRouter, PRODUCT_READ_ROLES, PRODUCT_WRITE_ROLES };
