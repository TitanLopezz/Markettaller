const express = require('express');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const {handleError}=require('../errorResponse');
const route = handler => async (req,res) => {
  try { res.json(await handler(req)); }
  catch (error) {handleError(res,error);}
};
const createShopRouter = commerce => {
  const router = express.Router();
  router.get('/config', (_req,res) => res.json(commerce.config));
  router.get('/catalog', route(()=>commerce.catalog()));
  router.post('/forgot-password',route(req=>commerce.forgotPassword(req.body)));
  router.post('/reset-password',route(req=>commerce.resetPassword(req.body)));
  router.use(verifyToken);
  router.get('/notifications',route(req=>commerce.notifications(req.user.id)));
  router.patch('/notifications/read',route(req=>commerce.readNotifications(req.user.id)));
  router.get('/admin/orders',verifyRole(['super_admin']),route(req=>commerce.listOrders(req.user.id,true,req.query.page || 1)));
  router.patch('/admin/orders/:id',verifyRole(['super_admin']),route(req=>commerce.updateOrder(req.params.id,req.user.id,req.body,true)));
  router.get('/fulfillment/orders',verifyRole(['gestor','super_admin']),route(req=>commerce.listOrders(req.user.id,true,req.query.page || 1)));
  router.patch('/fulfillment/orders/:id/instructions',verifyRole(['gestor','super_admin']),route(req=>commerce.saveFulfillment(req.params.id,req.user.id,req.body)));
  router.patch('/fulfillment/orders/:id',verifyRole(['gestor','super_admin']),route(req=>commerce.updateFulfillment(req.params.id,req.user.id,req.body)));
  router.use(verifyRole(['cliente']));
  router.post('/checkout',route(req=>commerce.checkout(req.user.id,req.body)));
  router.get('/orders',route(req=>commerce.listOrders(req.user.id,false,req.query.page || 1)));
  router.get('/orders/:id',route(req=>commerce.getOrder(req.params.id,req.user.id)));
  router.post('/orders/:id/cancel',route(req=>commerce.updateOrder(req.params.id,req.user.id,{status:'cancelado'},false)));
  router.get('/addresses',route(req=>commerce.addresses(req.user.id)));
  router.post('/addresses',route(req=>commerce.saveAddress(req.user.id,req.body)));
  router.delete('/addresses/:id',route(req=>commerce.deleteAddress(req.user.id,req.params.id)));
  return router;
};
module.exports = { createShopRouter };
