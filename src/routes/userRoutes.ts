import { Router } from 'express';
import { userController } from '../controllers';
import { userContextMiddleware } from '../middlewares';

const router = Router();

/**
 * @swagger
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Create a new user
 *     description: |
 *       Create a new user account. This is the first step for testing the API.
 *       
 *       **Testing Steps:**
 *       1. Create a user with this endpoint
 *       2. Copy the "id" from the response
 *       3. Click "Authorize" at the top and paste the ID
 *       4. Now you can test other endpoints!
 *       
 *       **Roles:**
 *       - "GUEST" - Can browse and book slots
 *       - "HOST" - Can create slots (should also include GUEST to book)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *           examples:
 *             guest:
 *               summary: Create a guest user
 *               value:
 *                 email: guest@example.com
 *                 name: Guest User
 *                 roles: [GUEST]
 *             host:
 *               summary: Create a host user (can create slots)
 *               value:
 *                 email: host@example.com
 *                 name: Host User
 *                 roles: [HOST, GUEST]
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', (req, res, next) => {
  userController.createUser(req, res).catch(next);
});

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Get all users
 *     description: |
 *       Retrieve a paginated list of all users in the system.
 *       Useful for finding user IDs to use for testing.
 *     parameters:
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
 *         description: List of users
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
 *                     $ref: '#/components/schemas/User'
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
  userController.getAllUsers(req, res).catch(next);
});

/**
 * @swagger
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     description: Returns the profile of the authenticated user (based on x-user-id header).
 *     security:
 *       - UserIdHeader: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Missing or invalid user ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me', userContextMiddleware, (req, res, next) => {
  userController.getMe(req as any, res).catch(next);
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID
 *     description: Retrieve a specific user's public profile by their ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', (req, res, next) => {
  userController.getUserById(req, res).catch(next);
});

export default router;
