import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import type Redis from 'ioredis';

// Redis connection config
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(redisUrl);

// Lazy-loaded Redis client
let redisClient: Redis | null = null;

const createRedisClient = async (): Promise<Redis> => {
    const { default: Redis } = await import('ioredis');
  
    const client = new Redis({
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password || undefined,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  
    await client.connect();
    return client;
  };
  
export const getRedisClient = async (): Promise<Redis> => {
    if (!redisClient) {
        redisClient = await createRedisClient();
    }
    return redisClient;
};

interface RateLimitOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix: string;     // Redis key prefix
}

/**
 * Creates a rate limit middleware using Redis fixed window counter
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyPrefix } = options;
  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = await getRedisClient();
      const userId = (req as any).user?.userId || req.ip || 'anonymous';
      const key = `${keyPrefix}:${userId}`;

      // Atomic increment and get
      const count = await redis.incr(key);

      // Set expiry on first request in window
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      // Get TTL for response header
      const ttl = await redis.ttl(key);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + ttl);

      if (count > maxRequests) {
        res.status(StatusCodes.TOO_MANY_REQUESTS).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Please try again in ${ttl} seconds.`,
          },
        });
        return;
      }

      next();
    } catch (error) {
      // Fail open - if Redis is down, allow the request
      console.error('[RateLimit] Redis error, allowing request:', error);
      next();
    }
  };
}

/**
 * Rate limiter for booking endpoint: 10 requests per minute per user
 */
export const bookingRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 10,
  keyPrefix: 'rate:booking',
});

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRateLimitRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

