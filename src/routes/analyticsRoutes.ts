import { Router } from 'express';
import { analyticsController } from '../controllers';

const router = Router();

/**
 * @swagger
 * /admin/analytics:
 *   get:
 *     tags: [Analytics]
 *     summary: Get booking analytics
 *     description: |
 *       Retrieve comprehensive booking statistics for a specified date range.
 *       This endpoint is optimized for performance with 50K+ bookings.
 *       
 *       **Returns:**
 *       - Total number of bookings
 *       - Cancellation rate (percentage)
 *       - Daily booking counts
 *       - Top 5 busiest hosts
 *       
 *       **Note:** In production, this endpoint would require admin authentication.
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the analytics period
 *         example: "2026-01-01"
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the analytics period
 *         example: "2026-01-31"
 *     responses:
 *       200:
 *         description: Analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Analytics'
 *             example:
 *               success: true
 *               data:
 *                 totalBookings: 150
 *                 cancellationRate: 12.5
 *                 bookingsPerDay:
 *                   - date: "2026-01-15"
 *                     count: 25
 *                   - date: "2026-01-16"
 *                     count: 30
 *                 topHosts:
 *                   - hostId: "550e8400-e29b-41d4-a716-446655440000"
 *                     hostName: "Alice Host"
 *                     bookingCount: 45
 *                   - hostId: "550e8400-e29b-41d4-a716-446655440001"
 *                     hostName: "Bob Host"
 *                     bookingCount: 32
 *       400:
 *         description: Missing or invalid date parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: VALIDATION_ERROR
 *                 message: Validation failed
 *                 details:
 *                   - path: startDate
 *                     message: Required
 */
router.get('/analytics', (req, res, next) => {
  analyticsController.getAnalytics(req, res).catch(next);
});

export default router;
