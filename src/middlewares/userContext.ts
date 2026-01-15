import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, UnauthorizedError } from '../types';
import prisma from '../utils/prisma';

/**
 * Middleware to extract and validate user context from request headers.
 * 
 * For this simplified implementation, the user_id is passed in the headers.
 * In a production system, this would validate a JWT token or session.
 */
export const userContextMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string | undefined;
    
    if (!userId) {
      throw new UnauthorizedError('Missing x-user-id header');
    }

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Attach user context to request
    (req as AuthenticatedRequest).user = { userId };
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional user context middleware - doesn't require authentication
 * but will attach user context if header is present
 */
export const optionalUserContextMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string | undefined;
    
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (user) {
        (req as AuthenticatedRequest).user = { userId };
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

