import { Router } from 'express';
import slotRoutes from './slotRoutes';
import bookingRoutes from './bookingRoutes';
import analyticsRoutes from './analyticsRoutes';
import userRoutes from './userRoutes';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     description: Returns the API health status. Use this to verify the API is running.
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

// Mount routes
router.use('/slots', slotRoutes);
router.use('/bookings', bookingRoutes);
router.use('/admin', analyticsRoutes);
router.use('/users', userRoutes);

export default router;
