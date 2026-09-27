const express = require('express');
const cors = require('cors');
const { createUserRouter } = require('./routes/userRoutes');
const { createProductRouter } = require('./routes/productRoutes');
const { createOrderRouter } = require('./routes/orderRoutes');

const createApp = (useCases) => {
  const app = express();
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
  app.use('/api/users', createUserRouter(useCases));
  app.use('/api/products', createProductRouter(useCases));
  app.use('/api/orders', createOrderRouter(useCases));
  app.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada.' }));

  return app;
};

module.exports = { createApp };
