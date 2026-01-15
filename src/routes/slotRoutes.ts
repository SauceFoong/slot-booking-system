import { Router } from 'express';
import { slotController } from '../controllers';
import { userContextMiddleware } from '../middlewares';

const router = Router();

// All slot routes require authentication
router.use(userContextMiddleware);

/**
 * @swagger
 * /slots:
 *   post:
 *     tags: [Slots]
 *     summary: Create a new slot (Host only)
 *     description: |
 *       Create a new available time slot. Only users with the HOST role can create slots.
 *       
 *       **Requirements:**
 *       - User must have HOST role
 *       - Start time must be in the future
 *       - End time must be after start time
 *       - Slot cannot overlap with existing slots for the same host
 *     security:
 *       - UserIdHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSlotRequest'
 *           example:
 *             startTime: "2026-02-01T10:00:00Z"
 *             endTime: "2026-02-01T11:00:00Z"
 *     responses:
 *       201:
 *         description: Slot created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Slot'
 *       400:
 *         description: Invalid time range or slot in the past
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: User is not a host
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Slot overlaps with existing slot
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', (req, res, next) => {
  slotController.createSlot(req as any, res).catch(next);
});

/**
 * @swagger
 * /slots:
 *   get:
 *     tags: [Slots]
 *     summary: List slots
 *     description: |
 *       Get a paginated list of slots. Use filters to narrow down results.
 *     security:
 *       - UserIdHeader: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [AVAILABLE, BOOKED, CANCELLED]
 *         description: Filter by slot status
 *       - in: query
 *         name: hostId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by specific host
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter slots starting from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter slots ending before this date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of slots
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
 *                     $ref: '#/components/schemas/Slot'
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
  slotController.getAvailableSlots(req as any, res).catch(next);
});

/**
 * @swagger
 * /slots/host:
 *   get:
 *     tags: [Slots]
 *     summary: List host's own slots
 *     description: |
 *       Get all slots created by the authenticated host, including booked and cancelled slots.
 *       This is useful for hosts to manage their availability.
 *     security:
 *       - UserIdHeader: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [AVAILABLE, BOOKED, CANCELLED]
 *         description: Filter by slot status
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
 *         description: List of host's slots
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
 *                     allOf:
 *                       - $ref: '#/components/schemas/Slot'
 *                       - type: object
 *                         properties:
 *                           bookingId:
 *                             type: string
 *                             format: uuid
 *                             nullable: true
 *                           bookedByUserId:
 *                             type: string
 *                             format: uuid
 *                             nullable: true
 */
router.get('/host', (req, res, next) => {
  slotController.getHostSlots(req as any, res).catch(next);
});

/**
 * @swagger
 * /slots/{id}:
 *   get:
 *     tags: [Slots]
 *     summary: Get slot by ID
 *     description: Retrieve detailed information about a specific slot.
 *     security:
 *       - UserIdHeader: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Slot ID
 *     responses:
 *       200:
 *         description: Slot details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Slot'
 *       404:
 *         description: Slot not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', (req, res, next) => {
  slotController.getSlotById(req as any, res).catch(next);
});

/**
 * @swagger
 * /slots/{id}:
 *   delete:
 *     tags: [Slots]
 *     summary: Delete/cancel a slot (Host only)
 *     description: |
 *       Delete an unbooked slot. Only the host who created the slot can delete it.
 *       
 *       **Restrictions:**
 *       - Only the slot owner can delete it
 *       - Cannot delete a booked slot (cancel the booking first)
 *     security:
 *       - UserIdHeader: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Slot ID to delete
 *     responses:
 *       200:
 *         description: Slot deleted successfully
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
 *                     message:
 *                       type: string
 *                       example: Slot deleted successfully
 *       403:
 *         description: Not the slot owner
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
 *         description: Cannot delete booked slot
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id', (req, res, next) => {
  slotController.deleteSlot(req as any, res).catch(next);
});

export default router;
