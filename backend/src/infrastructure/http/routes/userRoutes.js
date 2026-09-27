const express = require('express');
const { createUserController } = require('../controllers/userController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

const createUserRouter = (useCases) => {
  const router = express.Router();
  const controller = createUserController(useCases);

  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.get('/pending', verifyToken, verifyRole(['Super Admin']), controller.listPending);
  router.patch('/:id/status', verifyToken, verifyRole(['Super Admin']), controller.updateStatus);

  return router;
};

module.exports = { createUserRouter };
