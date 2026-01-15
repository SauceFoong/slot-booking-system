process.env.USE_BOOKING_QUEUE = 'false';

import request from 'supertest';
import app from '../../src/index';
import { createTestHost, createTestUser, createTestSlot } from '../helpers';
import Redis from 'ioredis';

/**
 * RATE LIMIT TEST
 * 
 * Tests that the booking endpoint is rate limited to 10 requests per minute per user.
 * 
 * Requirements:
 * - Redis must be running on localhost:6379
 */
describe('Rate Limiting - Booking Endpoint', () => {
  let redis: Redis;
  let isRedisAvailable = true;

  beforeAll(async () => {
    try {
      redis = new Redis({
        host: 'localhost',
        port: 6379,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
    } catch {
      isRedisAvailable = false;
      console.warn('Redis not available - skipping rate limit tests');
    }
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
  });

  beforeEach(async () => {
    if (isRedisAvailable) {
      // Clear rate limit keys before each test
      const keys = await redis.keys('rate:booking:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  });

  it('should allow 10 requests within the rate limit', async () => {
    if (!isRedisAvailable) {
      console.log('Skipping: Redis not available');
      return;
    }

    const host = await createTestHost({ name: 'Rate Limit Host' });
    const user = await createTestUser({ name: 'Rate Limit User' });

    // Create 10 slots to book
    const slots = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        createTestSlot(host.id, {
          startTime: new Date(Date.now() + (24 + i * 2) * 60 * 60 * 1000),
          endTime: new Date(Date.now() + (25 + i * 2) * 60 * 60 * 1000),
        })
      )
    );

    // Make 10 requests (at the limit)
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/bookings')
        .set('x-user-id', user.id)
        .send({ slotId: slots[i].id });

      // Should NOT be rate limited (201 or other business error, but not 429)
      expect(res.status).not.toBe(429);
      expect(res.headers['x-ratelimit-limit']).toBe('10');
      expect(parseInt(res.headers['x-ratelimit-remaining'])).toBe(10 - (i + 1));
    }
  });

  it('should block the 11th request with 429', async () => {
    if (!isRedisAvailable) {
      console.log('Skipping: Redis not available');
      return;
    }

    const host = await createTestHost({ name: 'Rate Limit Host 2' });
    const user = await createTestUser({ name: 'Rate Limit User 2' });

    // Create 11 slots
    const slots = await Promise.all(
      Array.from({ length: 11 }, (_, i) =>
        createTestSlot(host.id, {
          startTime: new Date(Date.now() + (24 + i * 2) * 60 * 60 * 1000),
          endTime: new Date(Date.now() + (25 + i * 2) * 60 * 60 * 1000),
        })
      )
    );

    // Make 10 requests (at the limit)
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/bookings')
        .set('x-user-id', user.id)
        .send({ slotId: slots[i].id });
    }

    // 11th request should be rate limited
    const res = await request(app)
      .post('/api/bookings')
      .set('x-user-id', user.id)
      .send({ slotId: slots[10].id });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('should track rate limits per user independently', async () => {
    if (!isRedisAvailable) {
      console.log('Skipping: Redis not available');
      return;
    }

    const host = await createTestHost({ name: 'Rate Limit Host 3' });
    const user1 = await createTestUser({ name: 'User One' });
    const user2 = await createTestUser({ name: 'User Two' });

    // Create slots
    const slots = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        createTestSlot(host.id, {
          startTime: new Date(Date.now() + (24 + i * 2) * 60 * 60 * 1000),
          endTime: new Date(Date.now() + (25 + i * 2) * 60 * 60 * 1000),
        })
      )
    );

    // User 1 makes 10 requests (hits limit)
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/bookings')
        .set('x-user-id', user1.id)
        .send({ slotId: slots[i].id });
    }

    // User 1's 11th request should be rate limited
    const user1Res = await request(app)
      .post('/api/bookings')
      .set('x-user-id', user1.id)
      .send({ slotId: slots[10].id });
    expect(user1Res.status).toBe(429);

    // User 2 should still be able to make requests
    const user2Res = await request(app)
      .post('/api/bookings')
      .set('x-user-id', user2.id)
      .send({ slotId: slots[11].id });
    expect(user2Res.status).not.toBe(429);
  });
});

