import { createTestHost, createTestUser, createTestSlot } from '../helpers';
import { prisma } from '../helpers';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { bookingService } from '../../src/services';
import { AppError } from '../../src/types';

// Inline queue setup for tests to avoid import side effects
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(redisUrl);
const connection = {
  host: url.hostname,
  port: parseInt(url.port) || 6379,
  password: url.password || undefined,
  maxRetriesPerRequest: null,
};

interface BookingJobData {
  userId: string;
  slotId: string;
  timestamp: number;
}

interface BookingJobResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    statusCode: number;
  };
}

/**
 * QUEUE-BASED FCFS TEST
 * 
 * This test verifies that the queue system correctly processes booking
 * requests in First-Come-First-Served order under high load.
 * 
 * Requirements:
 * - Redis must be running on localhost:6379
 */
describe('Queue-Based FCFS Booking', () => {
  let bookingQueue: Queue<BookingJobData, BookingJobResult>;
  let bookingQueueEvents: QueueEvents;
  let worker: Worker<BookingJobData, BookingJobResult>;
  let isRedisAvailable = true;

  // Helper to add job and wait for result
  async function addBookingJob(userId: string, slotId: string): Promise<BookingJobResult> {
    const job = await bookingQueue.add('create-booking', {
      userId,
      slotId,
      timestamp: Date.now(),
    });
    return await job.waitUntilFinished(bookingQueueEvents, 30000) as BookingJobResult;
  }

  beforeAll(async () => {
    // Check if Redis is available
    try {
      bookingQueue = new Queue<BookingJobData, BookingJobResult>('booking-test', {
        connection,
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        },
      });
      
      await bookingQueue.getJobCounts();
      
      bookingQueueEvents = new QueueEvents('booking-test', { connection });
      
      // Create worker
      worker = new Worker<BookingJobData, BookingJobResult>(
        'booking-test',
        async (job) => {
          const { userId, slotId } = job.data;
          try {
            const booking = await bookingService.createBooking(userId, slotId);
            return { success: true, data: booking };
          } catch (error) {
            if (error instanceof AppError) {
              return {
                success: false,
                error: { code: error.code, message: error.message, statusCode: error.statusCode },
              };
            }
            return {
              success: false,
              error: { code: 'INTERNAL_ERROR', message: 'Unknown error', statusCode: 500 },
            };
          }
        },
        { connection, concurrency: 1 }
      );
    } catch {
      isRedisAvailable = false;
      console.warn('Redis not available - skipping queue tests');
    }
  }, 10000);

  afterAll(async () => {
    if (isRedisAvailable) {
      await worker?.close();
      await bookingQueueEvents?.close();
      await bookingQueue?.close();
    }
  }, 10000);

  beforeEach(async () => {
    if (isRedisAvailable) {
      await bookingQueue.drain();
    }
  });

  it('should process booking jobs through the queue', async () => {
    if (!isRedisAvailable) {
      console.log('Skipping: Redis not available');
      return;
    }

    // Setup
    const host = await createTestHost({ name: 'Queue Test Host' });
    const slot = await createTestSlot(host.id);
    const user = await createTestUser({ name: 'Queue Test User' });

    // Add booking job directly to queue
    const result = await addBookingJob(user.id, slot.id);

    // Verify success
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // Verify booking was created
    const booking = await prisma.booking.findFirst({
      where: { slotId: slot.id, userId: user.id },
    });
    expect(booking).toBeDefined();
    expect(booking?.status).toBe('CONFIRMED');
  });

  it('should reject duplicate booking through queue', async () => {
    if (!isRedisAvailable) {
      console.log('Skipping: Redis not available');
      return;
    }

    // Setup
    const host = await createTestHost({ name: 'Queue Test Host 2' });
    const slot = await createTestSlot(host.id);
    const [user1, user2] = await Promise.all([
      createTestUser({ name: 'Queue User 1' }),
      createTestUser({ name: 'Queue User 2' }),
    ]);

    // First booking should succeed
    const result1 = await addBookingJob(user1.id, slot.id);
    expect(result1.success).toBe(true);

    // Second booking should fail
    const result2 = await addBookingJob(user2.id, slot.id);
    expect(result2.success).toBe(false);
    expect(result2.error?.code).toBe('CONFLICT'); // Slot is no longer available
  });

  it('should process high-load requests ensuring only one succeeds', async () => {
    if (!isRedisAvailable) {
      console.log('Skipping: Redis not available');
      return;
    }

    // Setup: Create host and slot
    const host = await createTestHost({ name: 'High Load Host' });
    const slot = await createTestSlot(host.id);

    // Create many users
    const userCount = 20;
    const users = await Promise.all(
      Array.from({ length: userCount }, (_, i) =>
        createTestUser({ name: `Load User ${i + 1}` })
      )
    );

    // Fire all requests simultaneously through the queue
    const jobPromises = users.map(user => addBookingJob(user.id, slot.id));
    const results = await Promise.all(jobPromises);

    // Count results
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    // Only one should succeed
    expect(successCount).toBe(1);
    expect(failCount).toBe(userCount - 1);

    // Verify the winner is in the database
    const booking = await prisma.booking.findFirst({
      where: { slotId: slot.id },
    });
    expect(booking).toBeDefined();

    console.log('Queue High-Load Test Results:');
    console.log(`  - Total requests: ${userCount}`);
    console.log(`  - Successful: ${successCount}`);
    console.log(`  - Rejected: ${failCount}`);
  });

  it('should handle burst traffic with multiple slots', async () => {
    if (!isRedisAvailable) {
      console.log('Skipping: Redis not available');
      return;
    }

    // Setup: Create host with multiple slots
    const host = await createTestHost({ name: 'Burst Test Host' });
    const slotCount = 5;
    const slots = await Promise.all(
      Array.from({ length: slotCount }, (_, i) =>
        createTestSlot(host.id, {
          startTime: new Date(Date.now() + (24 + i * 2) * 60 * 60 * 1000),
          endTime: new Date(Date.now() + (25 + i * 2) * 60 * 60 * 1000),
        })
      )
    );

    // Create many users (more than slots)
    const userCount = 25;
    const users = await Promise.all(
      Array.from({ length: userCount }, (_, i) =>
        createTestUser({ name: `Burst User ${i + 1}` })
      )
    );

    // Each user tries to book a slot (round-robin)
    const jobPromises = users.map((user, i) => {
      const slotIndex = i % slots.length;
      return addBookingJob(user.id, slots[slotIndex].id);
    });

    const results = await Promise.all(jobPromises);

    // Count successful bookings
    const successCount = results.filter(r => r.success).length;

    // Should have exactly as many successes as slots
    expect(successCount).toBe(slotCount);

    // Verify each slot has exactly one booking
    for (const slot of slots) {
      const bookings = await prisma.booking.findMany({
        where: { slotId: slot.id },
      });
      expect(bookings.length).toBe(1);
    }

    console.log('Burst Traffic Test Results:');
    console.log(`  - Slots available: ${slotCount}`);
    console.log(`  - Users trying: ${userCount}`);
    console.log(`  - Successful bookings: ${successCount}`);
  });

  it('should handle stress test with many concurrent requests', async () => {
    if (!isRedisAvailable) {
      console.log('Skipping: Redis not available');
      return;
    }

    // Setup
    const host = await createTestHost({ name: 'Stress Test Host' });
    const slot = await createTestSlot(host.id);

    // Create 30 users for stress test
    const userCount = 30;
    const users = await Promise.all(
      Array.from({ length: userCount }, (_, i) =>
        createTestUser({ name: `Stress User ${i + 1}` })
      )
    );

    // Fire all at once
    const startTime = Date.now();
    const jobPromises = users.map(user => addBookingJob(user.id, slot.id));
    const results = await Promise.all(jobPromises);
    const endTime = Date.now();

    const successCount = results.filter(r => r.success).length;
    const duration = endTime - startTime;

    // Only one should succeed
    expect(successCount).toBe(1);

    console.log('Stress Test Results:');
    console.log(`  - Total requests: ${userCount}`);
    console.log(`  - Processed in: ${duration}ms`);
    console.log(`  - Avg per request: ${(duration / userCount).toFixed(2)}ms`);
  }, 60000); // 60 second timeout for stress test
});

