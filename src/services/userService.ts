import { UserRole } from '@prisma/client';
import { userRepository } from '../repositories';
import { NotFoundError, UserResponse, ConflictError } from '../types';

export class UserService {
  /**
   * Get all users with pagination
   */
  async getAllUsers(options?: { page?: number; limit?: number }): Promise<{
    users: UserResponse[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const result = await userRepository.findAll({ page, limit });

    return {
      users: result.users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
      total: result.total,
      page,
      limit,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserResponse | null> {
    const user = await userRepository.findById(userId);
    
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Create a new user
   */
  async createUser(data: {
    email: string;
    name: string;
    roles?: UserRole[];
  }): Promise<UserResponse> {
    // Check if email already exists
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    const user = await userRepository.create({
      email: data.email,
      name: data.name,
      roles: data.roles ?? [UserRole.GUEST],
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Add a role to a user
   */
  async addRoleToUser(userId: string, role: UserRole): Promise<UserResponse> {
    const user = await userRepository.findById(userId);
    
    if (!user) {
      throw new NotFoundError('User');
    }

    const updatedUser = await userRepository.addRole(userId, role);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      roles: updatedUser.roles,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }
}

export const userService = new UserService();

