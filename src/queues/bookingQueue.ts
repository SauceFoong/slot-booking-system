import { Queue, QueueEvents } from 'bullmq';

// Redis connection config for BullMQ
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(redisUrl);
const connection = {
  host: url.hostname,
  port: parseInt(url.port) || 6379,
  password: url.password || undefined,
  maxRetriesPerRequest: null,
};

// Booking job data interface
export interface BookingJobData {
  userId: string;
  slotId: string;
  timestamp: number;
}

// Booking job result interface
export interface BookingJobResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    statusCode: number;
  };
}

// Create the booking queue
export const bookingQueue = new Queue<BookingJobData, BookingJobResult>('booking', {
  connection,
  defaultJobOptions: {
    attempts: 1, // No retries - booking should succeed or fail immediately
    removeOnComplete: true,
    removeOnFail: true,
  },
});

// Queue events for waiting on job completion
export const bookingQueueEvents = new QueueEvents('booking', { connection });

// Helper to add a booking job and wait for result
export async function addBookingJob(
  userId: string,
  slotId: string,
  timeout = 30000 // 30 second timeout
): Promise<BookingJobResult> {
  const job = await bookingQueue.add('create-booking', {
    userId,
    slotId,
    timestamp: Date.now(),
  });

  // Wait for the job to complete
  const result = await job.waitUntilFinished(bookingQueueEvents, timeout) as BookingJobResult;
  return result;
}

// Graceful shutdown
export async function closeBookingQueue(): Promise<void> {
  await bookingQueueEvents.close();
  await bookingQueue.close();
}

