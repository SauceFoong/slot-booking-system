import { User, UserRole, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';

export class UserRepository {
  async findAll(options?: { page?: number; limit?: number }): Promise<{
    users: User[];
    total: number;
  }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count(),
    ]);

    return { users, total };
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: {
    email: string;
    name: string;
    roles?: UserRole[];
  }): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        roles: data.roles ?? [UserRole.GUEST],
      },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async hasRole(userId: string, role: UserRole): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    });
    return user?.roles.includes(role) ?? false;
  }

  async addRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    if (user.roles.includes(role)) {
      return user; // Role already exists
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        roles: {
          push: role,
        },
      },
    });
  }
}

export const userRepository = new UserRepository();

