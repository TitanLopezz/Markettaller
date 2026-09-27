const express = require('express');
const { createOrderController } = require('../controllers/orderController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

const createOrderRouter = (useCases) => {
  const router = express.Router();
  const controller = createOrderController(useCases);

  router.post('/', verifyToken, verifyRole(['Proveedor']), controller.create);
  router.get('/my-orders', verifyToken, verifyRole(['Proveedor']), controller.listMine);
  router.get('/pending', verifyToken, verifyRole(['Super Admin']), controller.listPending);
  router.patch('/:id/status', verifyToken, verifyRole(['Super Admin']), controller.updateStatus);

  return router;
};

module.exports = { createOrderRouter };
