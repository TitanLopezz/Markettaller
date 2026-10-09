const {handleError}=require('../errorResponse');

const createProductController = ({
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductRequest,
  listPendingProductRequests,
  updateProductRequestStatus,
  submitProductChange,
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
      const change=await submitProductChange({actor:req.user,requestType:'crear',product:req.body});
      if (change.pending) {
        return res.status(202).json({
          message: 'Solicitud de alta enviada al Super Admin.',
          request:change.request,
        });
      }
      return res.status(201).json({ product:change.product });
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
      const change=await submitProductChange({actor:req.user,requestType:'eliminar',productId:req.params.id});
      if (change.pending) {
        return res.status(202).json({
          message: 'Solicitud de eliminación enviada al Super Admin.',
          request:change.request,
        });
      }
      const result = change.result;
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
