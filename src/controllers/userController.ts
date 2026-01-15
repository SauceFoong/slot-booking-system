import { Request, Response } from 'express';
import { userService } from '../services';
import { AuthenticatedRequest, ApiResponse, NotFoundError } from '../types';
import { createUserSchema, paginationSchema } from '../utils/validation';
import { StatusCodes } from 'http-status-codes';

export class UserController {
  /**
   * GET /users
   * Get all users with pagination
   */
  async getAllUsers(req: Request, res: Response): Promise<void> {
    const { page, limit } = paginationSchema.parse(req.query);

    const result = await userService.getAllUsers({ page, limit });

    const response: ApiResponse = {
      success: true,
      data: result.users,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    };

    res.status(StatusCodes.OK).json(response);
  }

  /**
   * POST /users
   * Create a new user (for testing/setup purposes)
   */
  async createUser(req: Request, res: Response): Promise<void> {
    const input = createUserSchema.parse(req.body);

    const user = await userService.createUser(input);

    const response: ApiResponse = {
      success: true,
      data: user,
    };

    res.status(StatusCodes.CREATED).json(response);
  }

  /**
   * GET /users/me
   * Get the authenticated user's profile
   */
  async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.user;

    const user = await userService.getUserById(userId);

    if (!user) {
      throw new NotFoundError('User');
    }

    const response: ApiResponse = {
      success: true,
      data: user,
    };

    res.status(StatusCodes.OK).json(response);
  }

  /**
   * GET /users/:id
   * Get a user by ID
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;

    const user = await userService.getUserById(id);

    if (!user) {
      throw new NotFoundError('User');
    }

    const response: ApiResponse = {
      success: true,
      data: user,
    };

    res.status(StatusCodes.OK).json(response);
  }
}

export const userController = new UserController();

