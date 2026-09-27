const handleError = (res, error) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Error interno del servidor.' : error.message;
  return res.status(statusCode).json({ message });
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const createProductController = ({
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductRequest,
  listPendingProductRequests,
  updateProductRequestStatus,
}) => ({
  list: async (req, res) => {
    try {
      return res.json(await listProducts());
    } catch (error) {
      return handleError(res, error);
    }
  },
  create: async (req, res) => {
    try {
      if (normalizeRole(req.user.role) !== 'super_admin') {
        const request = await createProductRequest({
          requesterId: req.user.id,
          requestType: 'crear',
          product: req.body,
        });
        return res.status(202).json({
          message: 'Solicitud de alta enviada al Super Admin.',
          request,
        });
      }
      return res.status(201).json({ product: await createProduct(req.body) });
    } catch (error) {
      return handleError(res, error);
    }
  },
  update: async (req, res) => {
    try {
      return res.json({ product: await updateProduct({ ...req.body, id: req.params.id }) });
    } catch (error) {
      return handleError(res, error);
    }
  },
  delete: async (req, res) => {
    try {
      if (normalizeRole(req.user.role) !== 'super_admin') {
        const request = await createProductRequest({
          requesterId: req.user.id,
          requestType: 'eliminar',
          productId: req.params.id,
        });
        return res.status(202).json({
          message: 'Solicitud de eliminación enviada al Super Admin.',
          request,
        });
      }
      const result = await deleteProduct(req.params.id);
      return res.json({ message: 'Producto eliminado.', ...result });
    } catch (error) {
      return handleError(res, error);
    }
  },
  listPendingRequests: async (req, res) => {
    try {
      return res.json(await listPendingProductRequests());
    } catch (error) {
      return handleError(res, error);
    }
  },
  updateProductRequestStatus: async (req, res) => {
    try {
      const result = await updateProductRequestStatus({
        id: req.params.id,
        status: req.body.status,
        reviewerId: req.user.id,
      });
      return res.json({ message: 'Solicitud de producto actualizada.', request: result });
    } catch (error) {
      return handleError(res, error);
    }
  },
});

module.exports = { createProductController };
