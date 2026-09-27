const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Error interno del servidor.' : error.message;
  return res.status(statusCode).json({ message });
};

const createOrderController = ({ createOrder, listMyOrders, listPendingOrders, updateOrderStatus }) => ({
  create: async (req, res) => {
    try {
      const order = await createOrder({
        providerId: req.user.id,
        productId: req.body.product_id,
        quantity: req.body.quantity,
      });
      return res.status(201).json({ order });
    } catch (error) {
      return handleError(res, error);
    }
  },
  listMine: async (req, res) => {
    try {
      return res.json(await listMyOrders(req.user.id));
    } catch (error) {
      return handleError(res, error);
    }
  },
  listPending: async (req, res) => {
    try {
      return res.json(await listPendingOrders());
    } catch (error) {
      return handleError(res, error);
    }
  },
  updateStatus: async (req, res) => {
    try {
      const order = await updateOrderStatus({ id: req.params.id, status: req.body.status });
      return res.json({ message: 'Estado del pedido actualizado.', order });
    } catch (error) {
      return handleError(res, error);
    }
  },
});

module.exports = { createOrderController };
