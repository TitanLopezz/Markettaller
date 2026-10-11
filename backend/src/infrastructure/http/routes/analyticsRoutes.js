const express = require('express');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const { handleError } = require('../errorResponse');
// GET /api/analytics/dashboard?period=weekly&top=5 — docs/analytics.md
const createAnalyticsRouter = service => {
  const router = express.Router();
  router.get('/dashboard', verifyToken, verifyRole(['super_admin']), async (req,res) => {
    try { res.json(await service.dashboard(req.query)); }
    catch (error) { handleError(res,error); }
  });
  return router;
};
module.exports = { createAnalyticsRouter };
