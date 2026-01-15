import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import { errorHandler, notFoundHandler, requestLogger } from './middlewares';
import { swaggerSpec } from './config/swagger';
import { startBookingWorker, stopBookingWorker } from './workers';
import { closeBookingQueue } from './queues';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware - configure helmet to allow Swagger UI
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Swagger UI - available at /docs (Light Mode)
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Swagger JSON endpoint
app.get('/docs/json', (_req, res) => {
  res.json(swaggerSpec);
});

// API routes
app.use('/api', routes);

// Root endpoint - redirect to docs
app.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Slot Booking System API',
      version: '1.0.0',
      documentation: '/docs',
      health: '/api/health',
    },
  });
});

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Check if queue is enabled
const USE_QUEUE = process.env.USE_BOOKING_QUEUE === 'true';

// Start server (only if not in test mode)
if (process.env.NODE_ENV !== 'test') {
  // Start booking worker if queue is enabled
  if (USE_QUEUE) {
    startBookingWorker();
    console.log('Queue mode enabled for bookings');
  }

  const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`API documentation at http://localhost:${PORT}/docs`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    
    server.close(async () => {
      if (USE_QUEUE) {
        await stopBookingWorker();
        await closeBookingQueue();
      }
      console.log('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default app;

