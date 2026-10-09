const {handleError}=require('../errorResponse');

const createUserController = ({ registerUser, loginUser, listPendingUsers, updateUserStatus }) => ({
  register: async (req, res) => {
    try {
      const user = await registerUser(req.body);
      return res.status(201).json({
        message: user.role === 'cliente' ? 'Cuenta creada. Ya puedes iniciar sesión.' : 'Registro recibido. La cuenta está pendiente de autorización.',
        user,
      });
    } catch (error) {
      return handleError(res, error);
    }
  },
  login: async (req, res) => {
    try {
      return res.json(await loginUser(req.body));
    } catch (error) {
      return handleError(res, error);
    }
  },
  listPending: async (req, res) => {
    try {
      return res.json(await listPendingUsers());
    } catch (error) {
      return handleError(res, error);
    }
  },
  updateStatus: async (req, res) => {
    try {
      const user = await updateUserStatus({ id: req.params.id, status: req.body.status });
      return res.json({ message: 'Estado actualizado.', user });
    } catch (error) {
      return handleError(res, error);
    }
  },
});

module.exports = { createUserController };
