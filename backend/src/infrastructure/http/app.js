const express = require('express');
const cors = require('cors');
const { createUserRouter } = require('./routes/userRoutes');
const { createProductRouter } = require('./routes/productRoutes');
const { createOrderRouter } = require('./routes/orderRoutes');
const { createShopRouter } = require('./routes/shopRoutes');
const { verifyToken } = require('./middleware/authMiddleware');
const { rateLimit } = require('./middleware/rateLimit');
const {handleError}=require('./errorResponse');
const {createSubmitProductChange}=require('../../application/use-cases/submitProductChange');

const createApp = (useCases) => {
  useCases={...useCases,submitProductChange:useCases.submitProductChange||createSubmitProductChange(useCases)};
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use((_req,res,next)=>{
    res.set('X-Content-Type-Options','nosniff');
    res.set('Referrer-Policy','no-referrer');
    res.set('Cache-Control','no-store');
    next();
  });
  const localOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ];
  const allowedOrigins = new Set([
    process.env.FRONTEND_ORIGIN,
    ...(process.env.NODE_ENV === 'production' ? [] : localOrigins),
  ].filter(Boolean));

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origen no permitido por CORS.'));
    },
  }));
  app.use(express.json());
  const limit = rateLimit();
  for (const path of ['/api/users/login','/api/users/register','/api/shop/forgot-password','/api/shop/reset-password']) app.use(path,limit);
  if (useCases.authenticateSession) app.use('/api', (req,res,next)=>{
    if (!req.get('Authorization')) return next();
    verifyToken(req,res,async ()=>{
      try {
        await useCases.authenticateSession(req.user);
        next();
      } catch(error) {if(error.code)handleError(res,error);else res.status(503).json({message:'No se pudo verificar la sesión.'});}
    });
  });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/users', createUserRouter(useCases));
  app.use('/api/products', createProductRouter(useCases));
  app.use('/api/orders', createOrderRouter(useCases));
  if (useCases.commerce) app.use('/api/shop',createShopRouter(useCases.commerce));
  app.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada.' }));
  app.use((error,_req,res,_next)=>res.status(error.status || 500).json({message:error.type === 'entity.parse.failed'?'JSON inválido.':'No se pudo procesar la solicitud.'}));

  return app;
};

module.exports = { createApp };
