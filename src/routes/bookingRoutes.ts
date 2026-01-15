import { Router } from 'express';
import { bookingController } from '../controllers';
import { userContextMiddleware } from '../middlewares';

const router = Router();

// All booking routes require authentication
router.use(userContextMiddleware);

/**
 * @swagger
 * /bookings:
 *   post:
 *     tags: [Bookings]
 *     summary: Book a slot
 *     description: |
 *       Book an available time slot. This endpoint is **concurrency-safe** and handles
 *       race conditions when multiple users try to book the same slot.
 *       
 *       **Business Rules:**
 *       - Cannot book your own slot
 *       - Maximum 5 active (upcoming) bookings per user
 *       - Slot must be available and in the future
 *       
 *       **Concurrency Handling:**
 *       Uses pessimistic locking (SELECT FOR UPDATE) to prevent double-booking.
 *       If another user books the slot first, you'll receive a 409 Conflict error.
 *     security:
 *       - UserIdHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBookingRequest'
 *     responses:
 *       201:
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Booking'
 *       400:
 *         description: |
 *           Bad request:
 *           - Cannot book your own slot
 *           - Slot is in the past
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Slot not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: |
 *           Conflict:
 *           - Slot is no longer available (already booked)
 *           - Maximum active bookings reached
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               slotTaken:
 *                 summary: Slot was booked by another user
 *                 value:
 *                   success: false
 *                   error:
 *                     code: CONFLICT
 *                     message: Slot is no longer available
 *               maxBookings:
 *                 summary: User has too many bookings
 *                 value:
 *                   success: false
 *                   error:
 *                     code: CONFLICT
 *                     message: You have reached the maximum of 5 active bookings
 */
router.post('/', (req, res, next) => {
  bookingController.createBooking(req as any, res).catch(next);
});

/**
 * @swagger
 * /bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: List user's bookings
 *     description: Get all bookings for the authenticated user with optional filters.
 *     security:
 *       - UserIdHeader: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [CONFIRMED, CANCELLED]
 *         description: Filter by booking status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter bookings with slots starting from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter bookings with slots ending before this date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of user's bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Booking'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 */
router.get('/', (req, res, next) => {
  bookingController.getUserBookings(req as any, res).catch(next);
});

/**
 * @swagger
 * /bookings/{id}:
 *   get:
 *     tags: [Bookings]
 *     summary: Get booking by ID
 *     description: Retrieve detailed information about a specific booking. Users can only view their own bookings.
 *     security:
 *       - UserIdHeader: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Booking'
 *       403:
 *         description: Cannot view another user's booking
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', (req, res, next) => {
  bookingController.getBookingById(req as any, res).catch(next);
});

/**
 * @swagger
 * /bookings/{id}:
 *   delete:
 *     tags: [Bookings]
 *     summary: Cancel a booking
 *     description: |
 *       Cancel an existing booking. The slot will become available again for others to book.
 *       
 *       **Cancellation Rules:**
 *       - Only the user who made the booking can cancel it
 *       - Cancellation must be at least **1 hour before** the slot start time
 *       - Already cancelled bookings cannot be cancelled again
 *     security:
 *       - UserIdHeader: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Booking ID to cancel
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Cancellation not allowed (within 1 hour of slot start)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: BAD_REQUEST
 *                 message: Cancellation is only allowed at least 1 hour(s) before the slot start time
 *       403:
 *         description: Cannot cancel another user's booking
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Booking is already cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id', (req, res, next) => {
  bookingController.cancelBooking(req as any, res).catch(next);
});

export default router;
